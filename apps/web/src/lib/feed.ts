import {
  events,
  and,
  campusLocations,
  db,
  eq,
  eventTags,
  gt,
  gte,
  ilike,
  inArray,
  interactions,
  lt,
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
import { eventDiscoverableBy } from "~/lib/event-visibility";
import {
  CANDIDATE_HORIZON_DAYS,
  CANDIDATE_POOL_CAP,
  PERSONAL_CANDIDATE_CAP,
  type ScoringContext,
  compareScored,
  finalizeFeedOrder,
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
  /** Size of the ranked candidate list — exactly what offset/limit can reach. */
  total: number;
  /** ISO timestamp the ranking was computed for; pass it back as `asOf` for the next page. */
  asOf: string;
}

/** A stale `asOf` is ignored, so a tab left open overnight gets a fresh feed. */
const ASOF_MAX_AGE_MS = 30 * 60 * 1000;

function resolveNow(asOf: Date | undefined): number {
  const realNow = Date.now();
  if (!asOf) return realNow;
  const t = asOf.getTime();
  if (Number.isNaN(t) || t > realNow + 60_000 || realNow - t > ASOF_MAX_AGE_MS) return realNow;
  return t;
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

/**
 * Rank the Explore feed for `userId` and return one page of it.
 *
 * 1. Candidate generation (docs/ranking.md, "Candidate pool").
 * 2. Batched enrichment of every candidate — one `inArray` query per signal.
 * 3. Score, sort, then finalize ONE order over the whole list (org cap +
 *    soon-event quota) before slicing out the requested page.
 * 4. Attendee rosters are loaded for the returned page only.
 */
export async function loadRankedFeed(userId: string, query: FeedQuery): Promise<FeedPage> {
  const now = resolveNow(query.asOf);
  const nowDate = new Date(now);
  const asOf = nowDate.toISOString();

  // ── Viewer context ──────────────────────────────────────
  const [interestRows, friendIds, followedOrgRows, memberOrgRows, interactedOrgRows] =
    await Promise.all([
      db
        .select({ tag: userInterests.tag })
        .from(userInterests)
        .where(eq(userInterests.userId, userId)),
      loadFriendIds(userId),
      db
        .select({ orgId: orgFollowers.orgId })
        .from(orgFollowers)
        .where(eq(orgFollowers.userId, userId)),
      db.select({ orgId: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.userId, userId)),
      // Orgs the user has RSVP'd to before — a weaker org-affinity signal.
      db
        .selectDistinct({ orgId: events.orgId })
        .from(rsvps)
        .innerJoin(events, eq(rsvps.eventId, events.id))
        .where(eq(rsvps.userId, userId)),
    ]);

  const interestTags = interestRows.map((r) => r.tag);
  const myOrgIds = new Set([
    ...followedOrgRows.map((o) => o.orgId),
    ...memberOrgRows.map((o) => o.orgId),
  ]);
  const interactedOrgIds = new Set(
    interactedOrgRows.map((r) => r.orgId).filter((id): id is string => id !== null),
  );

  // ── Candidate generation ────────────────────────────────
  const conditions = [
    gt(events.datetime, nowDate),
    lt(events.datetime, dateRangeEnd(now, query.dateRange)),
    // Published AND visible to this viewer — see ~/lib/event-visibility.ts.
    eventDiscoverableBy(userId),
  ];

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
  };

  // Stage 1: everything within the horizon, soonest first, up to the cap.
  const timeOrdered = await db
    .select(candidateColumns)
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(...conditions))
    .orderBy(events.datetime, events.id)
    .limit(CANDIDATE_POOL_CAP);

  let candidates = timeOrdered;

  // Stage 2 (only if stage 1 saturated): events past the stage-1 cutoff that
  // carry a personal signal, so a dense calendar can't wall them off.
  const lastTimeOrdered = timeOrdered[timeOrdered.length - 1];
  if (timeOrdered.length === CANDIDATE_POOL_CAP && lastTimeOrdered) {
    const personalSignals = [
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
      `loadRankedFeed: time-ordered candidate pool hit CANDIDATE_POOL_CAP (${CANDIDATE_POOL_CAP}); ` +
        `ranked ${candidates.length} candidates after personalised expansion.`,
    );
  }

  if (candidates.length === 0) return { events: [], total: 0, asOf };

  // ── Batched enrichment (one query per signal, whole candidate set) ──
  const candidateIds = candidates.map((e) => e.id);
  const [tagRows, rsvpCountRows, viewCountRows, friendRsvpRows, myRsvpRows, mySaveRows] =
    await Promise.all([
      db
        .select({ eventId: eventTags.eventId, tag: eventTags.tag })
        .from(eventTags)
        .where(inArray(eventTags.eventId, candidateIds)),
      db
        .select({ eventId: rsvps.eventId, count: sql<number>`count(*)::int` })
        .from(rsvps)
        .where(inArray(rsvps.eventId, candidateIds))
        .groupBy(rsvps.eventId),
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
            inArray(interactions.itemId, candidateIds),
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
            .where(and(inArray(rsvps.eventId, candidateIds), inArray(rsvps.userId, friendIds))),
      db
        .select({ eventId: rsvps.eventId })
        .from(rsvps)
        .where(and(eq(rsvps.userId, userId), inArray(rsvps.eventId, candidateIds))),
      db
        .select({ eventId: savedEvents.eventId })
        .from(savedEvents)
        .where(and(eq(savedEvents.userId, userId), inArray(savedEvents.eventId, candidateIds))),
    ]);

  const tagsByEvent = groupBy(
    tagRows,
    (r) => r.eventId,
    (r) => r.tag,
  );
  const friendsByEvent = groupBy(
    friendRsvpRows,
    (r) => r.eventId,
    (r) => ({ id: r.id, displayName: r.displayName, avatarUrl: r.avatarUrl }),
  );
  const rsvpCountByEvent = new Map(rsvpCountRows.map((r) => [r.eventId, r.count]));
  const viewCountByEvent = new Map(viewCountRows.map((r) => [r.eventId, r.count]));
  const myRsvps = new Set(myRsvpRows.map((r) => r.eventId));
  const mySaves = new Set(mySaveRows.map((r) => r.eventId));

  // ── Score, sort, finalize ───────────────────────────────
  const ctx: ScoringContext = {
    userId,
    now,
    interestTags: new Set(interestTags),
    myOrgIds,
    interactedOrgIds,
  };

  const scored = candidates.map((event) => {
    const tags = tagsByEvent.get(event.id) ?? [];
    const friendsAttending = friendsByEvent.get(event.id) ?? [];
    const startsAt = event.datetime.getTime();
    const score = scoreEvent(
      {
        id: event.id,
        orgId: event.orgId,
        startsAt,
        createdAt: event.createdAt.getTime(),
        tags,
        friendsAttendingCount: friendsAttending.length,
        viewCount: viewCountByEvent.get(event.id) ?? 0,
      },
      ctx,
    );
    return { event, tags, friendsAttending, startsAt, score, id: event.id, orgId: event.orgId };
  });
  scored.sort(compareScored);

  const ordered = finalizeFeedOrder(scored, { now });
  const page = ordered.slice(query.offset, query.offset + query.limit);

  // ── Attendee rosters: final page only ───────────────────
  const pageIds = page.map((p) => p.id);
  const attendeeRows =
    pageIds.length === 0
      ? []
      : await db
          .select({
            eventId: rsvps.eventId,
            id: users.id,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          })
          .from(rsvps)
          .innerJoin(users, eq(rsvps.userId, users.id))
          .where(inArray(rsvps.eventId, pageIds))
          .orderBy(rsvps.createdAt);
  const attendeesByEvent = groupBy(
    attendeeRows,
    (r) => r.eventId,
    (r) => ({ id: r.id, displayName: r.displayName, avatarUrl: r.avatarUrl }),
  );

  return {
    events: page.map(({ event, tags, friendsAttending }) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      orgId: event.orgId,
      orgName: event.orgName,
      orgLogoUrl: event.orgLogoUrl ?? null,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      locationDetail: event.locationDetail ?? null,
      tags,
      flyerUrl: event.flyerUrl,
      rsvpCount: rsvpCountByEvent.get(event.id) ?? 0,
      friendsAttending,
      attendees: attendeesByEvent.get(event.id) ?? [],
      isRsvped: myRsvps.has(event.id),
      isSaved: mySaves.has(event.id),
    })),
    total: ordered.length,
    asOf,
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
