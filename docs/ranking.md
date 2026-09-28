# Explore feed ranking

This describes how `getFeedEvents()` (`apps/web/src/actions/events.ts`, implemented in `apps/web/src/lib/feed.ts`) orders the Explore
feed. It's a plain SQL + in-memory weighted score — no ML, no external service.

## The formula, in plain English

Every upcoming event gets a score built from seven signals, each roughly between 0 and 1,
multiplied by a weight:

| Signal | Weight | What it measures |
|---|---|---|
| Interest relevance | 3.0 | What fraction of this event's tags match your onboarding interests |
| Time proximity | 2.0 | How soon the event is — decays smoothly the further out it is |
| Friend RSVPs | 4.0 | How many of your friends are going (caps out at 3+) |
| Org affinity | 1.0 | Whether you follow/belong to the hosting org, or have RSVP'd to it before |
| Recency | 1.0 | Whether the event was posted in the last 1–3 days |
| Popularity | 0.5 | How many views the event has gotten, log-scaled |
| Random nudge | 0.5 | A small per-user-per-day nudge so the feed varies over time |

```
score = 3.0 × interest_relevance
      + 2.0 × time_proximity
      + 4.0 × friend_rsvp_score
      + 1.0 × org_affinity
      + 1.0 × recency_boost
      + 0.5 × popularity_score
      + 0.5 × random_nudge
```

Events are sorted by this score, highest first. Friend RSVPs carry the most weight — "people
you know are going" is the strongest signal on a campus app. Popularity and the random nudge
are deliberately small: they nudge the feed, they don't dominate it.

### Interest relevance

`matched tags / total tags on the event`. No interests set yet? Everyone gets a neutral 0.5
instead of 0, so a user with no interests still sees a normal feed, not everything at the
bottom.

### Time proximity — smooth decay

```
time_proximity = 2 ^ (-days_until / 4)
```

An event right now scores 1.0, halving every 4 days out (day 4 ≈ 0.5, day 14 ≈ 0.09, day 30
≈ 0.004). This replaced an earlier bucketed version (`≤1 day = 1.0, ≤3 days = 0.8, …`) whose
score could visibly jump as an event crossed a bucket boundary. The smooth curve keeps the
same intuition — sooner is better, distant events fade but never hit zero — without the jump.

### Friend RSVPs

`min(1.0, friends attending / 3)`. Three or more friends going is treated as maximally
compelling; it doesn't climb further past that.

### Org affinity — tiered

- **1.0** if you follow or belong to the event's org.
- **0.5** if you don't, but you've RSVP'd to that org's events before
  (`ORG_PAST_INTERACTION_AFFINITY` in `lib/feed-ranking.ts`) — a weaker signal of interest.
- **0** otherwise, or if the event has no org.

### Recency boost

1.0 if posted in the last 24 hours, 0.5 if posted in the last 3 days, 0 otherwise — surfaces
newly-posted events before other signals catch up.

### Popularity

```
popularity_score = min(1.0, log(view_count + 1) / log(POPULARITY_VIEW_CAP + 1))
```

Grows logarithmically with view count (logged via `interactions`, see
`apps/web/src/actions/interactions.ts`), capping at 1.0 around `POPULARITY_VIEW_CAP` (50)
views. `view_count` is the number of *distinct users* who viewed the event, so one account
re-opening (or scripting) an event can't inflate it; `logInteraction` is also rate-limited. It's
a live per-request count, not a batch job, so it stays cheap.

### Random nudge — seeded per user, per day

```
random_nudge = seededRandom(`${userId}:${today}:${event.id}`)
```

A deterministic hash of the user, the current UTC date, and the event ID, normalized to
`[0, 1)`. Not `Math.random()` — the same user looking at the same event on the same day
always gets the same nudge, so refreshing Explore never reshuffles it. The nudge changes
once a day, so events that would otherwise tie get some variety over time. Ties still break
by soonest event first.

## Where the code lives

| File | What |
|---|---|
| `apps/web/src/actions/events.ts` → `getFeedEvents()` | Server action: auth + zod validation of params, then delegates |
| `apps/web/src/lib/feed.ts` → `loadRankedFeed()` | Candidate generation, batched enrichment, pagination |
| `apps/web/src/lib/feed-ranking.ts` | Pure scoring + ordering (`scoreEvent`, `finalizeFeedOrder`) and every tunable constant |

## Pipeline

1. **Candidate generation** — which events get ranked at all (below).
2. **Batched enrichment** — tags, RSVP counts, view counts, friends attending, and the viewer's
   own RSVP/save state for *every* candidate, one `inArray(...)` query per signal (six queries
   total, independent of pool size). No per-event queries.
3. **Score + sort** — score desc, then soonest first, then event id. A total order, so the sort is
   fully deterministic.
4. **Finalize one order over the whole list** — org-diversity cap and soon-event quota
   (below) are applied to the complete ranked list, *before* pagination.
5. **Paginate** — the requested page is `finalOrder.slice(offset, offset + limit)`.
6. **Attendee rosters** — the full "N attending" list is loaded for the returned page only.

`total` is the length of the finalized list, so it always agrees with what `offset`/`limit` can
reach.

## Candidate pool

Scoring has to see more than one page — if only the 20 soonest events were scored, a highly
relevant event further out could never outrank a weak one that merely happens sooner.

**Stage 1 — calendar horizon.** Every published, visible, upcoming event matching the filters
within the next `CANDIDATE_HORIZON_DAYS` (45) days, rounded up to end of day, soonest first, up
to `CANDIDATE_POOL_CAP` (1000) rows. An explicit `dateRange` filter (`today`/`week`/`month`)
replaces the default horizon. At the expected scale (hundreds of events per semester) the cap
never binds and stage 1 *is* the whole pool. Scoring 1000 candidates in memory is a few
milliseconds; the batched enrichment queries stay well below Postgres' bind-parameter limit.

**Stage 2 — personalised expansion (only if stage 1 saturates).** If stage 1 returns exactly
`CANDIDATE_POOL_CAP` rows, a second query over the same filters and horizon fetches up to
`PERSONAL_CANDIDATE_CAP` (500) events *at or after* the stage-1 cutoff that carry a personal
signal: hosted by an org the viewer follows/belongs to, RSVP'd by a friend, or tagged with one
of the viewer's interests. These are merged (de-duplicated) into the pool. So a dense calendar
can crowd out generic far-future events, but not the ones this particular viewer is likely to
care about — unlike the old "100 soonest" hard wall. A warning is logged when this path runs,
as the signal to revisit the constants.

Events beyond the horizon never enter ranking by default — a product choice (Explore is about
the next several weeks), not a scale workaround.

## Org diversity cap

At most `ORG_DIVERSITY_CAP` (3) events from one org in any `ORG_DIVERSITY_WINDOW` (20)
consecutive feed positions — i.e. no page is dominated by one heavy-posting org. Events without
an org are never capped. Over-cap events are *deferred*, not dropped: they re-enter as soon as
the window slides past the org's earlier events. (The original PR #38 version deferred every
over-cap event to the very end of the feed; the sliding window keeps a followed org's 4th event
reachable a page later instead of behind hundreds of others.)

The only time the cap is exceeded is at the tail, when *every* remaining event is from an org
already at the cap in the current window — there is nothing else left to show, so the
highest-scoring remaining event is placed.

## Guaranteeing imminent events aren't buried

Friend RSVPs (weight 4.0) can outweigh time proximity (weight 2.0), so an event with strong social
signal three weeks out could outscore one happening tomorrow. To keep "what's happening soon"
visible, the first `SOON_INJECTION_WINDOW` (20) positions include at least `SOON_QUOTA` (3)
events starting within `SOON_WINDOW_DAYS` (1) day, spread evenly (by positions 5, 10 and 15).
Soon events that already rank there naturally count toward the quota; only a shortfall causes
the highest-scoring *missing* soon event to be pulled forward.

**The quota never breaks the org cap.** A soon event is only pulled forward if its org is under
the cap in the current window; if no such soon event exists, the quota is left unmet. "Max 3
per org per page" wins over "3 soon events near the top".

The window is fixed, independent of `limit`/`offset`, so page size never changes the order.

## Pagination and `asOf`

Both rules above are part of one greedy pass (`finalizeFeedOrder`) over the full ranked list,
producing a permutation of it (nothing added or dropped). Pages are plain slices of that array,
so within one ranking no event can appear on two pages or be skipped.

Scores depend on "now" (time proximity, recency, which events count as soon, the daily nudge
seed, and which events have already started). To keep page 2 a slice of the *same* ranking as
page 1, every response includes `asOf` — the instant it was ranked for — and the client sends it
back with the next `offset`. The server reuses it as "now" if it is at most 30 minutes old
(otherwise it ranks fresh). Data that changes between requests (a new RSVP, a new event) can
still shift the order slightly; the client de-duplicates by id when appending as a safety net.

All tunable constants (`CANDIDATE_HORIZON_DAYS`, `CANDIDATE_POOL_CAP`, `PERSONAL_CANDIDATE_CAP`,
`WEIGHTS`, `TIME_HALF_LIFE_DAYS`, `ORG_PAST_INTERACTION_AFFINITY`, `POPULARITY_VIEW_CAP`,
`ORG_DIVERSITY_CAP`, `ORG_DIVERSITY_WINDOW`, `SOON_WINDOW_DAYS`, `SOON_QUOTA`,
`SOON_INJECTION_WINDOW`) live at the top of `apps/web/src/lib/feed-ranking.ts`.

## Edge cases

- **No interests**: `interest_relevance` defaults to 0.5 for every event.
- **No friends**: `friend_rsvp_score` is 0; the friends-attending lookup is skipped entirely.
- **No org follows/memberships/past RSVPs**: `org_affinity` is 0.

None of these throw or produce an empty feed — a brand-new user with zero signals still gets
a full feed, ranked by time proximity, recency, popularity, and the random nudge alone.
