import {
  events,
  and,
  campusLocations,
  db,
  desc,
  eq,
  eventTags,
  gt,
  gte,
  ilike,
  inArray,
  interactions,
  lt,
  lte,
  or,
  orgFollowers,
  orgMembers,
  organizations,
  rsvps,
  savedEvents,
  sql,
  userInterests,
  users,
} from "@the-forum/database";
import type { FeedEvent } from "~/actions/events";
import { formatEventDateTime } from "~/lib/date-format";
import { eventDiscoverableBy, hiddenOrgIdsQuery, notFromHiddenOrg } from "~/lib/event-visibility";
import {
  CANDIDATE_HORIZON_DAYS,
  CANDIDATE_POOL_CAP,
  type FeedSort,
  PERSONAL_CANDIDATE_CAP,
  type ScoringContext,
  compareRecentlyPosted,
  compareScored,
  compareSoonest,
  finalizeFeedOrder,
  postedAt,
  scoreEvent,
} from "~/lib/feed-ranking";
import { loadFriendIds } from "~/lib/social-graph";
import { containsPattern } from "~/lib/sql-helpers";

type EventTag = typeof eventTags.$inferSelect.tag;
type OrgCategory = typeof organizations.$inferSelect.category;

export interface FeedQuery {
  search?: string;
  tags?: EventTag[];
  orgCategory?: OrgCategory;
  locationId?: string;
  dateRange?: "today" | "week" | "month";
  /** Defaults to "foryou". */
  sort?: FeedSort;
  limit: number;
  offset: number;
  /**
   * The instant page 1 was ranked at, echoed back by the client for later
   * pages so every page is a slice of the same ranking. Ignored if missing or
   * older than ASOF_MAX_AGE_MS.
   */
  asOf?: Date;
}

export interface FeedPage {
  events: FeedEvent[];
  /** Events in this ranking the viewer can still see (orgs hidden since `asOf` drop out). */
  total: number;
  /** Pass back as `offset` for the next page. */
  nextOffset: number;
  /** Visible events after `nextOffset` — 0 means this was the last page. */
  remaining: number;
  /** ISO timestamp the ranking was computed for; pass it back as `asOf` for the next page. */
  asOf: string;
  sort: FeedSort;
}

/** A stale `asOf` is ignored, so a tab left open overnight gets a fresh feed. */
const ASOF_MAX_AGE_MS = 30 * 60 * 1000;

/** The ranking instant, and whether it was pinned to a client-supplied `asOf`. */
function resolveNow(asOf: Date | undefined): { now: number; pinned: boolean } {
  const realNow = Date.now();
  if (!asOf) return { now: realNow, pinned: false };
  const t = asOf.getTime();
  if (Number.isNaN(t) || t > realNow + 60_000 || realNow - t > ASOF_MAX_AGE_MS) {
    return { now: realNow, pinned: false };
  }
  return { now: t, pinned: true };
}

function dateRangeEnd(now: number, dateRange: FeedQuery["dateRange"]): Date {
  if (dateRange === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  if (dateRange === "week") return new Date(now + 7 * 24 * 60 * 60 * 1000);
  if (dateRange === "month") return new Date(now + 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now);
  end.setDate(end.getDate() + CANDIDATE_HORIZON_DAYS);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** SQL twin of `postedAt()` in ~/lib/feed-ranking — keep the two in step. */
const postedAtSql = sql<Date>`coalesce(${events.announcedAt}, ${events.createdAt})`;

/**
 * One page of the Explore feed for `userId`, in the requested sort.
 *
 * 1. Candidate generation (docs/ranking.md, "Candidate pool") — the same set
 *    for every sort; hidden orgs are excluded here.
 * 2. Order the whole candidate list. "For you" first enriches every candidate
 *    (one `inArray` query per signal), scores it, then applies the org cap and
 *    soon-event quota; "Soonest" and "Recently posted" are plain sorts.
 * 3. Slice out the requested page, drop orgs hidden since `asOf`, and load the
 *    page's display data (tags, attendees, the viewer's RSVP/save state).
 */
export async function loadRankedFeed(userId: string, query: FeedQuery): Promise<FeedPage> {
  const sort = query.sort ?? "foryou";
  const { now, pinned } = resolveNow(query.asOf);
  const nowDate = new Date(now);
  const asOf = nowDate.toISOString();
  /*
   * On later pages (pinned to page 1's `asOf`), read viewer state as it was at
   * `asOf`: follows and hides made since then don't reorder a ranking the
   * client is already paging through, and events that entered The Forum since
   * then wait for the next fresh load. Otherwise a follow or a new event could
   * shift every later position by one, duplicating or skipping an event.
   */
  const snapshot = pinned ? nowDate : undefined;

  // ── Viewer context ──────────────────────────────────────
  const [interestRows, friendIds, followedOrgRows, memberOrgRows, interactedOrgRows, hiddenNow] =
    await Promise.all([
      db
        .select({ tag: userInterests.tag })
        .from(userInterests)
        .where(eq(userInterests.userId, userId)),
      loadFriendIds(userId),
      db
        .select({ orgId: orgFollowers.orgId })
        .from(orgFollowers)
        .where(
          snapshot
            ? and(eq(orgFollowers.userId, userId), lte(orgFollowers.createdAt, snapshot))
            : eq(orgFollowers.userId, userId),
        ),
      db.select({ orgId: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.userId, userId)),
      // Orgs the user has RSVP'd to before — a weaker org-affinity signal.
      db
        .selectDistinct({ orgId: events.orgId })
        .from(rsvps)
        .innerJoin(events, eq(rsvps.eventId, events.id))
        .where(eq(rsvps.userId, userId)),
      // Every org hidden right now, including since `asOf` — filtered from the page.
      hiddenOrgIdsQuery(userId),
    ]);

  const interestTags = interestRows.map((r) => r.tag);
  const myOrgIds = new Set([
    ...followedOrgRows.map((o) => o.orgId),
    ...memberOrgRows.map((o) => o.orgId),
  ]);
  const interactedOrgIds = new Set(
    interactedOrgRows.map((r) => r.orgId).filter((id): id is string => id !== null),
  );
  const hiddenOrgIds = new Set(hiddenNow.map((r) => r.orgId));
  const isVisible = (item: { orgId: string | null }) =>
    !item.orgId || !hiddenOrgIds.has(item.orgId);

  // ── Candidate generation ────────────────────────────────
  const conditions = [
    gt(events.datetime, nowDate),
    lt(events.datetime, dateRangeEnd(now, query.dateRange)),
    // Published AND visible to this viewer — see ~/lib/event-visibility.ts.
    eventDiscoverableBy(userId),
    // Not from an org the viewer hid (as of `asOf` on later pages).
    notFromHiddenOrg(userId, snapshot),
  ];
  if (snapshot) conditions.push(lte(events.createdAt, snapshot));

  if (query.search) {
    const pattern = containsPattern(query.search);
    const searchCondition = or(ilike(events.title, pattern), ilike(events.description, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }
  if (query.tags && query.tags.length > 0) {
    conditions.push(
      inArray(
        events.id,
        db
          .select({ eventId: eventTags.eventId })
          .from(eventTags)
          .where(inArray(eventTags.tag, query.tags)),
      ),
    );
  }
  if (query.orgCategory) {
    conditions.push(
      inArray(
        events.orgId,
        db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.category, query.orgCategory)),
      ),
    );
  }
  if (query.locationId) {
    conditions.push(eq(events.locationId, query.locationId));
  }

  const candidateColumns = {
    id: events.id,
    title: events.title,
    description: events.description,
    datetime: events.datetime,
    flyerUrl: events.flyerUrl,
    locationName: campusLocations.name,
    orgId: events.orgId,
    orgName: organizations.name,
    orgLogoUrl: organizations.logoUrl,
    locationDetail: events.locationDetail,
    createdAt: events.createdAt,
    announcedAt: events.announcedAt,
    announcementCount: events.announcementCount,
    source: events.source,
  };

  // Stage 1: everything within the horizon, up to the cap — soonest first, or
  // for "Recently posted" newest-posted first, so the cap (if it ever binds)
  // keeps the events that sort would show first.
  const timeOrdered = await db
    .select(candidateColumns)
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(...conditions))
    .orderBy(
      ...(sort === "recent"
        ? [desc(postedAtSql), events.datetime, events.id]
        : [events.datetime, events.id]),
    )
    .limit(CANDIDATE_POOL_CAP);

  let candidates = timeOrdered;

  // Stage 2 ("For you" only, and only if stage 1 saturated): events past the
  // stage-1 cutoff that carry a personal signal, so a dense calendar can't wall
  // them off.
  const lastTimeOrdered = timeOrdered[timeOrdered.length - 1];
  if (timeOrdered.length === CANDIDATE_POOL_CAP && lastTimeOrdered) {
    const personalSignals =
      sort !== "foryou"
        ? []
        : [
            myOrgIds.size > 0 ? inArray(events.orgId, [...myOrgIds]) : undefined,
            friendIds.length > 0
              ? inArray(
                  events.id,
                  db
                    .select({ eventId: rsvps.eventId })
                    .from(rsvps)
                    .where(inArray(rsvps.userId, friendIds)),
                )
              : undefined,
            interestTags.length > 0
              ? inArray(
                  events.id,
                  db
                    .select({ eventId: eventTags.eventId })
                    .from(eventTags)
                    .where(inArray(eventTags.tag, interestTags)),
                )
              : undefined,
          ].filter((c) => c !== undefined);

    if (personalSignals.length > 0) {
      const personal = await db
        .select(candidateColumns)
        .from(events)
        .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
        .leftJoin(organizations, eq(events.orgId, organizations.id))
        .where(
          and(
            ...conditions,
            gte(events.datetime, lastTimeOrdered.datetime),
            or(...personalSignals),
          ),
        )
        .orderBy(events.datetime, events.id)
        .limit(PERSONAL_CANDIDATE_CAP);

      const seen = new Set(timeOrdered.map((e) => e.id));
      candidates = [...timeOrdered, ...personal.filter((e) => !seen.has(e.id))];
    }

    console.warn(
      `loadRankedFeed: candidate pool hit CANDIDATE_POOL_CAP (${CANDIDATE_POOL_CAP}) for sort=${sort}; ` +
        `ordering ${candidates.length} candidates.`,
    );
  }

  if (candidates.length === 0) {
    return { events: [], total: 0, nextOffset: 0, remaining: 0, asOf, sort };
  }

  type Candidate = (typeof candidates)[number];
  const items = candidates.map((event: Candidate) => ({
    event,
    id: event.id,
    orgId: event.orgId,
    startsAt: event.datetime.getTime(),
    postedAt: postedAt(event),
  }));

  // ── Order the whole list ────────────────────────────────
  let ordered: typeof items;
  /** Scoring signals, loaded for every candidate ("For you") or just the page. */
  let signals: FeedSignals;

  if (sort === "foryou") {
    signals = await loadFeedSignals(
      items.map((i) => i.id),
      friendIds,
    );
    const ctx: ScoringContext = {
      userId,
      now,
      interestTags: new Set(interestTags),
      myOrgIds,
      interactedOrgIds,
    };
    const scored = items.map((item) => ({
      ...item,
      score: scoreEvent(
        {
          id: item.id,
          orgId: item.orgId,
          startsAt: item.startsAt,
          postedAt: item.postedAt,
          tags: signals.tags.get(item.id) ?? [],
          friendsAttendingCount: signals.friends.get(item.id)?.length ?? 0,
          viewCount: signals.views.get(item.id) ?? 0,
          source: item.event.source,
          announcementCount: item.event.announcementCount,
        },
        ctx,
      ),
    }));
    scored.sort(compareScored);
    ordered = finalizeFeedOrder(scored, { now });
  } else {
    ordered = [...items].sort(sort === "soonest" ? compareSoonest : compareRecentlyPosted);
    signals = { tags: new Map(), friends: new Map(), views: new Map() };
  }

  // ── Paginate ────────────────────────────────────────────
  // Offsets index the full ordered list; orgs hidden since `asOf` are dropped
  // from the output (and the counts) without shifting anyone's position.
  const nextOffset = Math.min(ordered.length, query.offset + query.limit);
  const page = ordered.slice(query.offset, nextOffset).filter(isVisible);
  const total = hiddenOrgIds.size === 0 ? ordered.length : ordered.filter(isVisible).length;
  const remaining = ordered.slice(nextOffset).filter(isVisible).length;

  // ── Page display data ───────────────────────────────────
  const pageIds = page.map((p) => p.id);
  if (sort !== "foryou") signals = await loadFeedSignals(pageIds, friendIds);
  const details = await loadPageDetails(userId, pageIds);

  return {
    events: page.map(({ event }) => {
      const attendees = details.attendees.get(event.id) ?? [];
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        orgId: event.orgId,
        orgName: event.orgName,
        orgLogoUrl: event.orgLogoUrl ?? null,
        isFollowingOrg: event.orgId ? details.followedOrgIds.has(event.orgId) : false,
        datetime: formatEventDateTime(event.datetime),
        rawDatetime: event.datetime.toISOString(),
        location: event.locationName ?? "TBD",
        locationDetail: event.locationDetail ?? null,
        tags: signals.tags.get(event.id) ?? [],
        flyerUrl: event.flyerUrl,
        rsvpCount: attendees.length,
        friendsAttending: signals.friends.get(event.id) ?? [],
        attendees,
        isRsvped: details.rsvped.has(event.id),
        isSaved: details.saved.has(event.id),
      };
    }),
    total,
    nextOffset,
    remaining,
    asOf,
    sort,
  };
}

type Person = { id: string; displayName: string; avatarUrl: string | null };

interface FeedSignals {
  tags: Map<string, string[]>;
  friends: Map<string, Person[]>;
  views: Map<string, number>;
}

/** Tags, friends attending and distinct-viewer counts — one query each, for any set of events. */
async function loadFeedSignals(eventIds: string[], friendIds: string[]): Promise<FeedSignals> {
  if (eventIds.length === 0) return { tags: new Map(), friends: new Map(), views: new Map() };
  const [tagRows, viewCountRows, friendRsvpRows] = await Promise.all([
    db
      .select({ eventId: eventTags.eventId, tag: eventTags.tag })
      .from(eventTags)
      .where(inArray(eventTags.eventId, eventIds)),
    // Distinct viewers, not raw view rows, so one user re-opening (or
    // scripting) an event can't inflate its popularity.
    db
      .select({
        eventId: interactions.itemId,
        count: sql<number>`count(distinct ${interactions.userId})::int`,
      })
      .from(interactions)
      .where(
        and(
          inArray(interactions.itemId, eventIds),
          eq(interactions.itemType, "event"),
          eq(interactions.interactionType, "view"),
        ),
      )
      .groupBy(interactions.itemId),
    friendIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            eventId: rsvps.eventId,
            id: users.id,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          })
          .from(rsvps)
          .innerJoin(users, eq(rsvps.userId, users.id))
          .where(and(inArray(rsvps.eventId, eventIds), inArray(rsvps.userId, friendIds))),
  ]);
  return {
    tags: groupBy(
      tagRows,
      (r) => r.eventId,
      (r) => r.tag,
    ),
    friends: groupBy(
      friendRsvpRows,
      (r) => r.eventId,
      (r) => ({ id: r.id, displayName: r.displayName, avatarUrl: r.avatarUrl }),
    ),
    views: new Map(viewCountRows.map((r) => [r.eventId, r.count])),
  };
}

interface PageDetails {
  attendees: Map<string, Person[]>;
  rsvped: Set<string>;
  saved: Set<string>;
  /** Orgs the viewer follows right now — the card menu's Follow/Unfollow state. */
  followedOrgIds: Set<string>;
}

/** Attendee rosters, the viewer's RSVP/save state and current follows — for the returned page only. */
async function loadPageDetails(userId: string, pageIds: string[]): Promise<PageDetails> {
  if (pageIds.length === 0) {
    return { attendees: new Map(), rsvped: new Set(), saved: new Set(), followedOrgIds: new Set() };
  }
  const [attendeeRows, saveRows, followRows] = await Promise.all([
    db
      .select({
        eventId: rsvps.eventId,
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(rsvps)
      .innerJoin(users, eq(rsvps.userId, users.id))
      .where(inArray(rsvps.eventId, pageIds))
      .orderBy(rsvps.createdAt),
    db
      .select({ eventId: savedEvents.eventId })
      .from(savedEvents)
      .where(and(eq(savedEvents.userId, userId), inArray(savedEvents.eventId, pageIds))),
    db
      .select({ orgId: orgFollowers.orgId })
      .from(orgFollowers)
      .where(eq(orgFollowers.userId, userId)),
  ]);
  return {
    attendees: groupBy(
      attendeeRows,
      (r) => r.eventId,
      (r) => ({ id: r.id, displayName: r.displayName, avatarUrl: r.avatarUrl }),
    ),
    rsvped: new Set(attendeeRows.filter((r) => r.id === userId).map((r) => r.eventId)),
    saved: new Set(saveRows.map((r) => r.eventId)),
    followedOrgIds: new Set(followRows.map((r) => r.orgId)),
  };
}

function groupBy<R, V>(rows: readonly R[], key: (row: R) => string, value: (row: R) => V) {
  const map = new Map<string, V[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(value(row));
    else map.set(k, [value(row)]);
  }
  return map;
}
