/**
 * Pure ranking logic for the Explore feed — no DB, no auth, so it can be
 * unit-tested and reasoned about in isolation. The data loading lives in
 * `~/lib/feed.ts`; the formula and ordering rules are documented in
 * docs/ranking.md. Keep the two in sync.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// ── Candidate generation ──────────────────────────────────

/**
 * Default lookahead when no `dateRange` filter is given, rounded up to end of
 * day. A calendar-distance bound rather than a row count, so an event is never
 * excluded just because many other events happen to be scheduled sooner.
 */
export const CANDIDATE_HORIZON_DAYS = 45;

/**
 * Upper bound on the time-ordered candidate query. Hundreds of events over
 * 45 days fit comfortably; this only binds if the calendar gets very dense.
 * When it does, a second, personalised candidate query (followed/member orgs,
 * friend RSVPs, interest tags) runs over the same horizon so strong-signal
 * events further out still make it into ranking. See docs/ranking.md.
 */
export const CANDIDATE_POOL_CAP = 1000;
export const PERSONAL_CANDIDATE_CAP = 500;

// ── Sorts ─────────────────────────────────────────────────

/**
 * Home/Explore sort options. Every sort ranks the same candidate set (same
 * filters, same horizon, blocked orgs excluded); only the order differs.
 *  - `foryou`: the weighted score below, plus the org-diversity cap and the
 *    soon-event quota.
 *  - `soonest`: start time ascending.
 *  - `recent`: when it was posted — first listserv announcement, else when it
 *    entered The Forum — newest first.
 */
export const FEED_SORTS = ["foryou", "soonest", "recent"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];
export const DEFAULT_FEED_SORT: FeedSort = "foryou";

// ── Scoring ───────────────────────────────────────────────

export const WEIGHTS = {
  interest: 3.0,
  time: 2.0,
  friends: 4.0,
  org: 4.0,
  source: 2.5,
  recency: 1.0,
  popularity: 0.5,
  random: 0.5,
} as const;

/** Time proximity halves every this many days. */
export const TIME_HALF_LIFE_DAYS = 4;

/**
 * Org affinity when you've RSVP'd to the org before but don't follow/belong to
 * it. With WEIGHTS.org = 4 that is worth 0.6 — about what it was before
 * following was strengthened — while a follow is worth the full 4.0.
 */
export const ORG_PAST_INTERACTION_AFFINITY = 0.15;

/**
 * Source quality, multiplied by WEIGHTS.source. Events announced on a campus
 * listserv earn up to 1.0, growing gently with repeat announcements (see
 * `sourceQuality`). Official MyPrincetonU listings nobody emailed about are
 * numerous and uneven, so they sit slightly below neutral and fill in under
 * announced events. Events created in The Forum are posted by a student on
 * purpose: slightly positive.
 */
export const SOURCE_QUALITY = {
  /** An announcement count that earns the full boost (log2(1 + 3) / 2 = 1). */
  announcementsForFull: 3,
  unannouncedOfficial: -0.3,
  manual: 0.2,
} as const;

/** View count treated as "maximally popular" (log-scaled, caps at 1.0). */
export const POPULARITY_VIEW_CAP = 50;

// ── Ordering ──────────────────────────────────────────────

/** At most this many events from one org in any ORG_DIVERSITY_WINDOW consecutive positions. */
export const ORG_DIVERSITY_CAP = 3;
/** Sliding window for the org cap. Equal to the default page size, so no page is dominated. */
export const ORG_DIVERSITY_WINDOW = 20;

/** An event is "soon" if it starts within this many days of `now`. */
export const SOON_WINDOW_DAYS = 1;
/** At least this many soon events land within the first SOON_INJECTION_WINDOW positions. */
export const SOON_QUOTA = 3;
/** Fixed window, independent of the request's `limit`, so page size never changes the order. */
export const SOON_INJECTION_WINDOW = 20;

/** Deterministic pseudo-random value in [0, 1) for a seed string. */
export function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0) / 0x100000000;
}

export interface ScoringContext {
  userId: string;
  /** The instant the ranking is computed for (see `asOf` in docs/ranking.md). */
  now: number;
  interestTags: ReadonlySet<string>;
  /** Orgs the viewer follows or belongs to. */
  myOrgIds: ReadonlySet<string>;
  /** Orgs whose events the viewer has RSVP'd to before. */
  interactedOrgIds: ReadonlySet<string>;
}

export interface ScoringInput {
  id: string;
  orgId: string | null;
  startsAt: number;
  /** When the event was posted: first listserv announcement, else when it entered The Forum. */
  postedAt: number;
  tags: readonly string[];
  friendsAttendingCount: number;
  viewCount: number;
  /** 'manual' | 'myprincetonu' | 'listserv' (or a legacy value, treated as neutral). */
  source: string;
  /** Campus listserv emails that announced the event (InboxEngine). */
  announcementCount: number;
}

/**
 * Source-quality signal in [-0.3, 1]:
 *  - announced on a listserv (any source): min(1, log2(1 + emails) / 2) —
 *    0.5 for one email, ~0.79 for two, 1.0 from three on;
 *  - official MyPrincetonU listing never announced: SOURCE_QUALITY.unannouncedOfficial;
 *  - created in The Forum: SOURCE_QUALITY.manual;
 *  - anything else: 0.
 */
export function sourceQuality(source: string, announcementCount: number): number {
  if (announcementCount > 0) {
    return Math.min(1, Math.log2(1 + announcementCount) / 2);
  }
  if (source === "myprincetonu") return SOURCE_QUALITY.unannouncedOfficial;
  if (source === "manual") return SOURCE_QUALITY.manual;
  return 0;
}

export function scoreEvent(event: ScoringInput, ctx: ScoringContext): number {
  // Fraction of this event's tags that match your interests. No interests set
  // yet → neutral 0.5 so a brand-new user still gets a normal feed.
  const matched = event.tags.filter((t) => ctx.interestTags.has(t)).length;
  const interestRelevance =
    ctx.interestTags.size === 0 ? 0.5 : event.tags.length === 0 ? 0 : matched / event.tags.length;

  // Half-life decay: 1.0 right now, halving every TIME_HALF_LIFE_DAYS days out.
  const daysUntil = Math.max(0, (event.startsAt - ctx.now) / DAY_MS);
  const timeProximity = 2 ** (-daysUntil / TIME_HALF_LIFE_DAYS);

  const friendRsvpScore = Math.min(1.0, event.friendsAttendingCount / 3.0);

  const orgAffinity = !event.orgId
    ? 0
    : ctx.myOrgIds.has(event.orgId)
      ? 1.0
      : ctx.interactedOrgIds.has(event.orgId)
        ? ORG_PAST_INTERACTION_AFFINITY
        : 0;

  const hoursSincePosted = (ctx.now - event.postedAt) / HOUR_MS;
  const recencyBoost = hoursSincePosted <= 24 ? 1.0 : hoursSincePosted <= 72 ? 0.5 : 0.0;

  const source = sourceQuality(event.source, event.announcementCount);

  const popularityScore = Math.min(
    1.0,
    Math.log(event.viewCount + 1) / Math.log(POPULARITY_VIEW_CAP + 1),
  );

  // Seeded per user, per (UTC) day, per event — varies over time but never on refresh.
  const day = new Date(ctx.now).toISOString().slice(0, 10);
  const randomNudge = seededRandom(`${ctx.userId}:${day}:${event.id}`);

  return (
    WEIGHTS.interest * interestRelevance +
    WEIGHTS.time * timeProximity +
    WEIGHTS.friends * friendRsvpScore +
    WEIGHTS.org * orgAffinity +
    WEIGHTS.source * source +
    WEIGHTS.recency * recencyBoost +
    WEIGHTS.popularity * popularityScore +
    WEIGHTS.random * randomNudge
  );
}

/** Score desc, then soonest first, then id — a total order, so sorting is fully deterministic. */
export function compareScored(
  a: { id: string; score: number; startsAt: number },
  b: { id: string; score: number; startsAt: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.startsAt !== b.startsAt) return a.startsAt - b.startsAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * When an event was posted, for "Recently posted" and the recency boost: its
 * first listserv announcement if it had one, else when it entered The Forum
 * (created there, or first synced from MyPrincetonU).
 */
export function postedAt(event: { announcedAt: Date | null; createdAt: Date }): number {
  return (event.announcedAt ?? event.createdAt).getTime();
}

/** "Soonest": start time ascending, then id. */
export function compareSoonest(
  a: { id: string; startsAt: number },
  b: { id: string; startsAt: number },
): number {
  if (a.startsAt !== b.startsAt) return a.startsAt - b.startsAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** "Recently posted": posted time descending, then soonest first, then id. */
export function compareRecentlyPosted(
  a: { id: string; postedAt: number; startsAt: number },
  b: { id: string; postedAt: number; startsAt: number },
): number {
  if (a.postedAt !== b.postedAt) return b.postedAt - a.postedAt;
  return compareSoonest(a, b);
}

export interface OrderingOptions {
  now: number;
  orgCap?: number;
  orgWindow?: number;
  soonQuota?: number;
  soonWindowDays?: number;
  soonInjectionWindow?: number;
}

/**
 * Turn a score-sorted list into the final feed order, over the WHOLE candidate
 * list, before any pagination. Every page is then a plain slice of this one
 * array, so nothing can be duplicated or skipped across pages.
 *
 * Greedy, one position at a time:
 *  - An item is *allowed* at a position if its org has fewer than `orgCap`
 *    items in the previous `orgWindow - 1` positions (events without an org
 *    are never capped).
 *  - Within the first `soonInjectionWindow` positions, the soon quota is
 *    spread evenly (for 3 in 20: by positions 5, 10 and 15). When the quota is
 *    behind schedule, the highest-scoring *allowed* soon event is placed.
 *    Soon injection never breaks the org cap — if no allowed soon event
 *    exists, the quota is simply left unmet.
 *  - Otherwise the highest-scoring allowed item is placed.
 *  - If no remaining item is allowed (the rest of the feed is all from orgs
 *    already at the cap in this window), the highest-scoring remaining item is
 *    placed anyway. That only happens at the tail, where there is nothing else
 *    left to show.
 *
 * The result is a permutation of the input: same length, nothing dropped.
 */
export function finalizeFeedOrder<T extends { id: string; orgId: string | null; startsAt: number }>(
  sorted: readonly T[],
  opts: OrderingOptions,
): T[] {
  const orgCap = opts.orgCap ?? ORG_DIVERSITY_CAP;
  const orgWindow = opts.orgWindow ?? ORG_DIVERSITY_WINDOW;
  const soonQuota = opts.soonQuota ?? SOON_QUOTA;
  const soonCutoff = opts.now + (opts.soonWindowDays ?? SOON_WINDOW_DAYS) * DAY_MS;
  const front = Math.min(opts.soonInjectionWindow ?? SOON_INJECTION_WINDOW, sorted.length);

  const isSoon = (item: T) => item.startsAt <= soonCutoff;

  // Target positions for the soon quota, spread evenly through the front window.
  const soonTargets: number[] = [];
  for (let k = 0; k < soonQuota; k++) {
    soonTargets.push(Math.floor(((k + 1) * front) / (soonQuota + 1)));
  }

  const used = new Array<boolean>(sorted.length).fill(false);
  const windowCounts = new Map<string, number>();
  const result: T[] = [];
  let firstUnused = 0;
  let soonPlaced = 0;

  const allowed = (item: T) => !item.orgId || (windowCounts.get(item.orgId) ?? 0) < orgCap;

  const findFirst = (predicate: (item: T) => boolean): number => {
    for (let i = firstUnused; i < sorted.length; i++) {
      const item = sorted[i] as T;
      if (!used[i] && predicate(item)) return i;
    }
    return -1;
  };

  for (let position = 0; position < sorted.length; position++) {
    // Slide the org window: drop the item that just fell out of it.
    if (position >= orgWindow) {
      const leaving = result[position - orgWindow] as T;
      if (leaving.orgId) {
        windowCounts.set(leaving.orgId, (windowCounts.get(leaving.orgId) ?? 1) - 1);
      }
    }

    let pick = -1;
    if (position < front) {
      const requiredByNow = soonTargets.filter((t) => t <= position).length;
      if (soonPlaced < requiredByNow) {
        pick = findFirst((item) => isSoon(item) && allowed(item));
      }
    }
    if (pick === -1) pick = findFirst(allowed);
    if (pick === -1) pick = findFirst(() => true);

    const item = sorted[pick] as T;
    used[pick] = true;
    while (firstUnused < sorted.length && used[firstUnused]) firstUnused++;

    result.push(item);
    if (position < front && isSoon(item)) soonPlaced++;
    if (item.orgId) windowCounts.set(item.orgId, (windowCounts.get(item.orgId) ?? 0) + 1);
  }

  return result;
}
