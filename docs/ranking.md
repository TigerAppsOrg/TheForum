# Explore feed ranking

This describes how `getFeedEvents()` (`apps/web/src/actions/events.ts`, implemented in `apps/web/src/lib/feed.ts`) orders the Explore
feed. It's a plain SQL + in-memory weighted score — no ML, no external service.

## Sorts

Home/Explore has a sort control next to the Cards/List toggle, persisted in the URL
(`?sort=`) and remembered per browser:

| Sort | `sort=` | Order |
|---|---|---|
| For you (default) | `foryou` | The weighted score below, then the org-diversity cap and soon-event quota |
| Soonest | `soonest` | Start time ascending, then id |
| Recently posted | `recent` | `coalesce(announced_at, created_at)` descending, then soonest, then id |

Every sort orders the **same candidate set** — same filters (tags, search, …), same horizon,
hidden orgs excluded — so switching sort never changes the count, only the order. "Posted" is
when the event was first announced on a campus listserv (`events.announced_at`, from
InboxEngine), else when it entered The Forum (created here, or first synced from
MyPrincetonU). Soonest and Recently posted are deliberately plain sorts: no diversity cap, no
soon quota — if you ask for chronological, you get chronological.

## The formula, in plain English

For "For you", every upcoming event gets a score built from eight signals, each roughly between
0 and 1 (source quality: −0.3 to 1), multiplied by a weight:

| Signal | Weight | What it measures |
|---|---|---|
| Interest relevance | 3.0 | What fraction of this event's tags match your onboarding interests |
| Time proximity | 2.0 | How soon the event is — decays smoothly the further out it is |
| Friend RSVPs | 4.0 | How many of your friends are going (caps out at 3+) |
| Org affinity | 4.0 | Whether you follow/belong to the hosting org, or have RSVP'd to it before |
| Source quality | 2.5 | Announced on a campus listserv (boost) vs. an unannounced MyPrincetonU listing (mild penalty) |
| Recency | 1.0 | Whether the event was posted in the last 1–3 days |
| Popularity | 0.5 | How many views the event has gotten, log-scaled |
| Random nudge | 0.5 | A small per-user-per-day nudge so the feed varies over time |

```
score = 3.0 × interest_relevance
      + 2.0 × time_proximity
      + 4.0 × friend_rsvp_score
      + 4.0 × org_affinity
      + 2.5 × source_quality
      + 1.0 × recency_boost
      + 0.5 × popularity_score
      + 0.5 × random_nudge
```

Events are sorted by this score, highest first. Friend RSVPs and following the host carry the
most weight — "people you know are going" and "you asked to see this org" are the strongest
signals on a campus app. Popularity and the random nudge are deliberately small: they nudge the
feed, they don't dominate it.

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

- **1.0** (worth +4.0) if you follow or belong to the event's org.
- **0.15** (worth +0.6) if you don't, but you've RSVP'd to that org's events before
  (`ORG_PAST_INTERACTION_AFFINITY` in `lib/feed-ranking.ts`) — a weaker signal of interest.
- **0** otherwise, or if the event has no org.

Following is an explicit "show me more of this", so it is weighted like friend RSVPs: +4.0
equals the whole time-proximity range (2.0) and the gap between an announced and an
unannounced listing (2.0) combined, so a followed org's event two or three weeks out still
reaches the first page. The org
diversity cap (below) still limits any one org to 3 of every 20 positions, so following a
prolific org spreads its events across pages rather than flooding page 1.

### Source quality — listserv announcements

Official MyPrincetonU listings are numerous (most of the feed) and uneven in quality; an
event someone bothered to announce on a campus listserv is a much better signal. InboxEngine
reports, per event, how many listserv emails announced it (`events.announcement_count`: its
own email for listserv-extracted events, plus reminder emails folded into it; official events
that were also emailed count too).

```
announced (count ≥ 1):          min(1, log2(1 + count) / 2)   → +1.25 / +1.98 / +2.5 (1 / 2 / 3+ emails)
unannounced MyPrincetonU (0):   −0.3                          → −0.75
created in The Forum:           +0.2                          → +0.5
anything else:                  0
```

The boost grows gently with repeats (a reminder email is evidence, not a vote to spam) and
saturates at 3. The gap between one announcement and an unannounced listing (2.0) equals the
whole time-proximity range, so announced events lead and unannounced listings fill in below
them rather than dominating by sheer number — while the soon-event quota still guarantees
tonight's events a place near the top. Forum-created events are posted by a student on
purpose, so they sit slightly above neutral, below an announced event.

### Recency boost

1.0 if posted in the last 24 hours, 0.5 if posted in the last 3 days, 0 otherwise — surfaces
newly-posted events before other signals catch up. "Posted" is the same instant "Recently
posted" sorts by: first listserv announcement, else when the event entered The Forum.

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
| `apps/web/src/lib/feed-ranking.ts` | Pure scoring + ordering (`scoreEvent`, `sourceQuality`, `finalizeFeedOrder`, `compareSoonest`, `compareRecentlyPosted`) and every tunable constant |
| `apps/web/src/lib/event-visibility.ts` → `notFromHiddenOrg()` | The hidden-org filter shared by every discovery surface |
| `apps/web/src/lib/feed-ranking.test.ts`, `feed-controls.db.test.ts` | Unit tests of the scoring/sorts; end-to-end checks against a synced database |

## Pipeline

1. **Candidate generation** — which events get ranked at all (below). Identical for every sort.
2. **Batched enrichment** ("For you" only) — tags, view counts and friends attending for
   *every* candidate, one `inArray(...)` query per signal (three queries, independent of pool
   size). No per-event queries.
3. **Score + sort** ("For you") — score desc, then soonest first, then event id. A total order, so
   the sort is fully deterministic. Soonest / Recently posted use their own total orders instead.
4. **Finalize one order over the whole list** ("For you") — org-diversity cap and soon-event
   quota (below) are applied to the complete ranked list, *before* pagination.
5. **Paginate** — the requested page is `finalOrder.slice(offset, offset + limit)`, minus any
   org hidden since `asOf` (see "Hiding organizations").
6. **Page details** — attendee rosters, the viewer's RSVP/save/follow state (and, for the plain
   sorts, tags and friends) are loaded for the returned page only.

`total` counts the finalized list minus orgs hidden since `asOf`, `nextOffset` is where the next
page starts and `remaining` how many visible events lie beyond it, so the numbers always agree
with what the client can reach.

## Candidate pool

Scoring has to see more than one page — if only the 20 soonest events were scored, a highly
relevant event further out could never outrank a weak one that merely happens sooner.

**Stage 1 — calendar horizon.** Every published, visible, upcoming event matching the filters
within the next `CANDIDATE_HORIZON_DAYS` (45) days, rounded up to end of day, not hosted by an
org the viewer hid, soonest first (newest-posted first for Recently posted), up to
`CANDIDATE_POOL_CAP` (1000) rows. An explicit `dateRange` filter (`today`/`week`/`month`)
replaces the default horizon. At the expected scale (hundreds of events per semester) the cap
never binds and stage 1 *is* the whole pool. Scoring 1000 candidates in memory is a few
milliseconds; the batched enrichment queries stay well below Postgres' bind-parameter limit.

**Stage 2 — personalised expansion (For you only, and only if stage 1 saturates).** If stage 1 returns exactly
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

## Hiding organizations

"Hide events from <Org>" (event card / event page menu, or the org page) writes a row to
`org_blocks`. Hidden orgs are removed by `notFromHiddenOrg()` in
`lib/event-visibility.ts` — never scored, in any sort — and the same filter is applied to the
map, similar events, friends' activity ("Friends going") and org suggestions. It is
deliberately *not* applied to the org's own page, direct event links, or your own RSVPs and
saves: hiding filters discovery, it doesn't make events unreachable. Hiding and following are
mutually exclusive (hiding unfollows, following unhides), and every write is idempotent.

## Pagination and `asOf`

Both rules above are part of one greedy pass (`finalizeFeedOrder`) over the full ranked list,
producing a permutation of it (nothing added or dropped). Pages are plain slices of that array,
so within one ranking no event can appear on two pages or be skipped. The same holds for the
plain sorts, whose orders are total (ties broken by id).

Scores depend on "now" (time proximity, recency, which events count as soon, the daily nudge
seed, and which events have already started). To keep page 2 a slice of the *same* ordering as
page 1, every response includes `asOf` — the instant it was ranked for — and the client sends it
back with the next `offset` (the response's `nextOffset`) and the same sort. The server reuses
it as "now" if it is at most 30 minutes old (otherwise it ranks fresh).

A pinned `asOf` also pins the viewer state that could reorder the list: only follows, hides
and events that existed at `asOf` are used for ordering. So following an org or a newly synced
event can't shift every later position by one mid-scroll (it takes effect on the next fresh
load). An org hidden *since* `asOf` is instead dropped from the output — from the page, `total`
and `remaining` — without re-ranking, so nothing else moves: the card disappears immediately
and page 2 continues exactly where page 1 ended. Remaining sources of drift (a new RSVP, an
unfollow of an older follow) can still shift the order slightly; the client de-duplicates by
id when appending as a safety net.

All tunable constants (`CANDIDATE_HORIZON_DAYS`, `CANDIDATE_POOL_CAP`, `PERSONAL_CANDIDATE_CAP`,
`WEIGHTS`, `TIME_HALF_LIFE_DAYS`, `ORG_PAST_INTERACTION_AFFINITY`, `SOURCE_QUALITY`, `POPULARITY_VIEW_CAP`,
`ORG_DIVERSITY_CAP`, `ORG_DIVERSITY_WINDOW`, `SOON_WINDOW_DAYS`, `SOON_QUOTA`,
`SOON_INJECTION_WINDOW`) live at the top of `apps/web/src/lib/feed-ranking.ts`.

## Edge cases

- **No interests**: `interest_relevance` defaults to 0.5 for every event.
- **No friends**: `friend_rsvp_score` is 0; the friends-attending lookup is skipped entirely.
- **No org follows/memberships/past RSVPs**: `org_affinity` is 0.

- **No announcement data** (e.g. rows synced before `announcement_count` existed): the sync
  backfills them on its next run, since it rewrites any row whose stored announcement signals
  differ from InboxEngine's.

None of these throw or produce an empty feed — a brand-new user with zero signals still gets
a full feed, ranked by time proximity, source quality, recency, popularity, and the random
nudge alone.
