# Explore feed ranking

This describes how `getFeedEvents()` (`apps/web/src/actions/events.ts`) orders the Explore
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
  (`ORG_PAST_INTERACTION_AFFINITY` in `events.ts`) — a weaker signal of interest.
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
views. It's a live per-request count, not a batch job, so it stays cheap.

### Random nudge — seeded per user, per day

```
random_nudge = seededRandom(`${userId}:${today}:${event.id}`)
```

A deterministic hash of the user, the current UTC date, and the event ID, normalized to
`[0, 1)`. Not `Math.random()` — the same user looking at the same event on the same day
always gets the same nudge, so refreshing Explore never reshuffles it. The nudge changes
once a day, so events that would otherwise tie get some variety over time. Ties still break
by soonest event first.

## Candidate pool: why scoring needs more than one page

The DB query pulls every upcoming, published event matching the feed's filters — not just the
requested page (`limit`/`offset`) — scores all of them, sorts by score, and only then slices
out the requested page. If scoring only ever ran against the 20 events the caller asked for,
personalization would have nothing to work with — the soonest 20 would always be exactly
what's returned, just reshuffled. Scoring the full candidate set lets a highly relevant event
further down the calendar outrank a less relevant one that merely happens sooner, no matter
how many other events are scheduled in between.

`total` is simply the size of that candidate set, so it always agrees with what `limit`/`offset`
can actually reach — there's no separate count that could promise more than pagination can
deliver. Enrichment (tags, rsvp/view counts, friend attendance, user state) is batched via
`inArray(...)` across the whole candidate set rather than queried per event, so a wider pool
doesn't multiply query count — it stays at a fixed handful of queries regardless of how many
candidates are scored.

### Bounded by calendar distance, not row count

When no explicit `dateRange` filter is applied, candidates are bounded to the next
`CANDIDATE_HORIZON_DAYS` (14) days, rounded up to the end of that day. This replaced an earlier
version that capped the candidate pool at a fixed row count (the soonest 100 events) — that
approach meant a highly relevant event could be excluded from ranking entirely just because 100
*other* events happened to be scheduled sooner, regardless of how strong its interest/friend/org
signal was. A calendar-distance bound doesn't have that failure mode: every event within the
next two weeks is always a candidate, no matter how many other events fall before it. An
explicit `dateRange` param (`today`/`week`/`month`) overrides the default horizon with its own
narrower or wider window.

Events further out than the horizon never enter ranking by default — this is an intentional
product choice (Explore surfaces what's happening soon, not the whole semester's calendar), not
a scale workaround. `CANDIDATE_POOL_SAFETY_VALVE` (5000) is a separate, purely defensive row
limit on top of the horizon, in case an unusually dense window ever produced a pathological
result size — it isn't expected to bind at realistic campus-event scale.

## Org diversity cap

After sorting by score, results are capped at `ORG_DIVERSITY_CAP` (3) events per org — once
an org hits 3, its remaining events are pushed later (not dropped), so one heavily-posting
org can't dominate the top of the feed. Events without an org are never capped.

## Guaranteeing imminent events aren't buried

Friend RSVPs (weight 4.0) can outweigh time proximity (weight 2.0), so an event with strong
social signal three weeks out could in principle outscore one happening tomorrow with no
friends attending yet. To keep "what's happening soon" reliably visible, the first
`SOON_INJECTION_WINDOW` (20) positions of the ranked, diversified feed always include at least
`SOON_QUOTA` (3) events within `SOON_WINDOW_DAYS` (1) day, even if their score wouldn't
naturally place them there.

This window is a fixed size, independent of the `limit`/`offset` a given request happens to
use — the whole feed is reordered into one final, stable sequence first, and *then* sliced into
pages. That means two requests for the same feed with different page sizes see the same
underlying order, and no event can appear on two different pages or be silently dropped by the
guarantee.

This is a **merge**, not a score override: if the front of the feed already has enough soon
events, nothing changes. Otherwise the highest-scoring soon events missing from that window are
interleaved into it at evenly-spaced positions, removed from their original later position —
everything else keeps its normal score order. It only backfills what score order left out, the
way feeds inject a freshness quota without letting it take over the whole ranking.

All the tunable constants above (`SOON_WINDOW_DAYS`, `SOON_QUOTA`, `SOON_INJECTION_WINDOW`,
`ORG_DIVERSITY_CAP`, `CANDIDATE_HORIZON_DAYS`, `CANDIDATE_POOL_SAFETY_VALVE`,
`POPULARITY_VIEW_CAP`, `POPULARITY_WEIGHT`, `RANDOM_WEIGHT`, `ORG_PAST_INTERACTION_AFFINITY`)
live at the top of `events.ts`.

## Edge cases

- **No interests**: `interest_relevance` defaults to 0.5 for every event.
- **No friends**: `friend_rsvp_score` is 0; the friends-attending lookup is skipped entirely.
- **No org follows/memberships/past RSVPs**: `org_affinity` is 0.

None of these throw or produce an empty feed — a brand-new user with zero signals still gets
a full feed, ranked by time proximity, recency, popularity, and the random nudge alone.
