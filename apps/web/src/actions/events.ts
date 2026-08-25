"use server";

import {
  events,
  and,
  campusLocations,
  db,
  desc,
  eq,
  eventTags,
  friendships,
  gt,
  ilike,
  inArray,
  interactions,
  lt,
  ne,
  notifications,
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
import { revalidatePath } from "next/cache";
import { auth } from "~/auth";
import { formatEventDateTime } from "~/lib/date-format";

export interface FeedEvent {
  id: string;
  title: string;
  description: string | null;
  orgId: string | null;
  orgName: string | null;
  datetime: string;
  location: string;
  tags: string[];
  flyerUrl: string | null;
  rsvpCount: number;
  friendsAttending: { id: string; displayName: string; avatarUrl: string | null }[];
  isRsvped: boolean;
  isSaved: boolean;
}

// Default lookahead when no `dateRange` filter is given, rounded up to end
// of day. A calendar-distance bound, not a row count, so it never depends
// on how many other events happen to be scheduled sooner. See docs/ranking.md.
const CANDIDATE_HORIZON_DAYS = 14;

// Defensive-only cap on result size within the horizon — not a ranking
// boundary, and not expected to bind at realistic campus-event scale.
const CANDIDATE_POOL_SAFETY_VALVE = 5000;

// An event is "soon" if it's within this many days. At least SOON_QUOTA
// such events always land within the first SOON_INJECTION_WINDOW positions
// of the feed, even if their score is weak.
const SOON_WINDOW_DAYS = 1;
const SOON_QUOTA = 3;

// Fixed window, independent of the request's `limit` — so the same
// underlying order results no matter what page size a given call uses.
const SOON_INJECTION_WINDOW = 20;

// Max events from one org before the rest get pushed later in the ranking.
const ORG_DIVERSITY_CAP = 3;

// Org affinity when you've RSVP'd to the org before but don't follow/belong
// to it (full affinity is 1.0).
const ORG_PAST_INTERACTION_AFFINITY = 0.5;

// View count treated as "maximally popular" (log-scaled, caps at 1.0).
const POPULARITY_VIEW_CAP = 50;
const POPULARITY_WEIGHT = 0.5;

// Small per-event nudge, seeded per user-per-day (not per request) so it
// varies the feed over time without ever reshuffling on refresh.
const RANDOM_WEIGHT = 0.5;

// Deterministic pseudo-random value in [0, 1) for a seed string.
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0) / 0xffffffff;
}

function diversifyByOrg<T extends { orgId: string | null }>(list: T[], cap: number): T[] {
  const counts = new Map<string, number>();
  const primary: T[] = [];
  const deferred: T[] = [];
  for (const item of list) {
    if (!item.orgId) {
      primary.push(item);
      continue;
    }
    const count = counts.get(item.orgId) ?? 0;
    if (count < cap) {
      counts.set(item.orgId, count + 1);
      primary.push(item);
    } else {
      deferred.push(item);
    }
  }
  return [...primary, ...deferred];
}

export async function getFeedEvents(params?: {
  search?: string;
  tags?: string[];
  orgCategory?: string;
  locationId?: string;
  dateRange?: "today" | "week" | "month";
  limit?: number;
  offset?: number;
}): Promise<{ events: FeedEvent[]; total: number }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  // Get user's interests for scoring
  const myInterests = await db
    .select({ tag: userInterests.tag })
    .from(userInterests)
    .where(eq(userInterests.userId, userId));
  const myInterestTags = myInterests.map((i) => i.tag);

  // Get user's friend IDs
  const friendRows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted")));
  const reverseFriendRows = await db
    .select({ friendId: friendships.userId })
    .from(friendships)
    .where(and(eq(friendships.friendId, userId), eq(friendships.status, "accepted")));
  const friendIds = [
    ...friendRows.map((f) => f.friendId),
    ...reverseFriendRows.map((f) => f.friendId),
  ];

  // Get orgs the user follows or belongs to, for the org-affinity signal
  const followedOrgRows = await db
    .select({ orgId: orgFollowers.orgId })
    .from(orgFollowers)
    .where(eq(orgFollowers.userId, userId));
  const memberOrgRows = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  const myOrgIds = new Set([
    ...followedOrgRows.map((o) => o.orgId),
    ...memberOrgRows.map((o) => o.orgId),
  ]);

  // Orgs the user has RSVP'd to before but doesn't follow/belong to — a
  // weaker org-affinity signal than myOrgIds.
  const interactedOrgRows = await db
    .select({ orgId: events.orgId })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .where(eq(rsvps.userId, userId));
  const interactedOrgIds = new Set(
    interactedOrgRows.map((r) => r.orgId).filter((id): id is string => id !== null),
  );

  // Day string (UTC) that seeds the random nudge — flips once a day.
  const today = new Date().toISOString().slice(0, 10);

  // Build base query conditions — only show published events in the feed
  const conditions = [gt(events.datetime, new Date()), eq(events.status, "published")];

  if (params?.search) {
    const searchCondition = or(
      ilike(events.title, `%${params.search}%`),
      ilike(events.description, `%${params.search}%`),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (params?.tags && params.tags.length > 0) {
    const typedTags = params.tags as (typeof eventTags.$inferSelect.tag)[];
    const eventsWithTags = db
      .select({ eventId: eventTags.eventId })
      .from(eventTags)
      .where(inArray(eventTags.tag, typedTags));
    conditions.push(inArray(events.id, eventsWithTags));
  }

  if (params?.orgCategory) {
    const orgsInCategory = db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        eq(
          organizations.category,
          params.orgCategory as typeof organizations.$inferSelect.category,
        ),
      );
    conditions.push(inArray(events.orgId, orgsInCategory));
  }

  if (params?.locationId) {
    conditions.push(eq(events.locationId, params.locationId));
  }

  // No explicit dateRange filter defaults to the candidate horizon, so
  // there's one date-bounding path instead of a separate "no filter"
  // branch — see docs/ranking.md.
  const now = new Date();
  let dateRangeEnd: Date;
  if (params?.dateRange === "today") {
    dateRangeEnd = new Date(now);
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (params?.dateRange === "week") {
    dateRangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (params?.dateRange === "month") {
    dateRangeEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    dateRangeEnd = new Date(now);
    dateRangeEnd.setDate(dateRangeEnd.getDate() + CANDIDATE_HORIZON_DAYS);
    dateRangeEnd.setHours(23, 59, 59, 999);
  }
  conditions.push(lt(events.datetime, dateRangeEnd));

  // Score every candidate within the horizon, not just the requested page —
  // batched enrichment below keeps this cheap regardless of pool size. See
  // docs/ranking.md.
  const rawEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
      createdAt: events.createdAt,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(...conditions))
    .orderBy(events.datetime)
    .limit(CANDIDATE_POOL_SAFETY_VALVE);

  if (rawEvents.length === 0) {
    return { events: [], total: 0 };
  }

  // Matches exactly what was fetched, so it's always consistent with what
  // offset/limit can reach — unlike a separate unbounded COUNT(*).
  const total = rawEvents.length;

  if (rawEvents.length === CANDIDATE_POOL_SAFETY_VALVE) {
    console.warn(
      `getFeedEvents: candidate pool hit CANDIDATE_POOL_SAFETY_VALVE (${CANDIDATE_POOL_SAFETY_VALVE}); total may be an undercount.`,
    );
  }

  const candidateIds = rawEvents.map((e) => e.id);

  // Batch every per-candidate lookup into one query each, instead of one
  // query per candidate. Grouped in memory afterward by eventId/itemId.
  const [tagRows, rsvpCountRows, viewCountRows, friendRsvpRows, userRsvpRows, userSaveRows] =
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

      db
        .select({ eventId: interactions.itemId, count: sql<number>`count(*)::int` })
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
        ? []
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

  const tagsByEvent = new Map<string, (typeof eventTags.$inferSelect.tag)[]>();
  for (const row of tagRows) {
    const list = tagsByEvent.get(row.eventId);
    if (list) list.push(row.tag);
    else tagsByEvent.set(row.eventId, [row.tag]);
  }

  const rsvpCountByEvent = new Map(rsvpCountRows.map((r) => [r.eventId, r.count]));
  const viewCountByEvent = new Map(viewCountRows.map((r) => [r.eventId, r.count]));

  const friendsByEvent = new Map<
    string,
    { id: string; displayName: string; avatarUrl: string | null }[]
  >();
  for (const row of friendRsvpRows) {
    const entry = { id: row.id, displayName: row.displayName, avatarUrl: row.avatarUrl };
    const list = friendsByEvent.get(row.eventId);
    if (list) list.push(entry);
    else friendsByEvent.set(row.eventId, [entry]);
  }

  const userRsvpEventIds = new Set(userRsvpRows.map((r) => r.eventId));
  const userSaveEventIds = new Set(userSaveRows.map((r) => r.eventId));

  // Enrich each event and compute its weighted relevance score. Full
  // formula breakdown: docs/ranking.md.
  const enriched: (FeedEvent & { score: number; _rawDatetime: Date })[] = rawEvents.map((event) => {
    const tagNames = tagsByEvent.get(event.id) ?? [];
    const rsvpCount = rsvpCountByEvent.get(event.id) ?? 0;
    const viewCount = viewCountByEvent.get(event.id) ?? 0;
    const friendsAttending = friendsByEvent.get(event.id) ?? [];

    // Fraction of this event's tags that match your interests.
    const matchedTags = tagNames.filter((t) => myInterestTags.includes(t)).length;
    const interestRelevance =
      myInterestTags.length === 0 ? 0.5 : tagNames.length === 0 ? 0 : matchedTags / tagNames.length;

    const now = Date.now();
    const eventTime = event.datetime.getTime();
    const daysUntil = (eventTime - now) / (1000 * 60 * 60 * 24);
    // Half-life decay: 1.0 right now, halving every 4 days out.
    const timeProximity = 2 ** (-daysUntil / 4);

    const friendRsvpScore = Math.min(1.0, friendsAttending.length / 3.0);

    // Full affinity if you follow/belong to the org, weaker if you've
    // just RSVP'd to it before.
    const orgAffinity = !event.orgId
      ? 0
      : myOrgIds.has(event.orgId)
        ? 1.0
        : interactedOrgIds.has(event.orgId)
          ? ORG_PAST_INTERACTION_AFFINITY
          : 0;

    const hoursSinceCreated = (now - event.createdAt.getTime()) / (1000 * 60 * 60);
    const recencyBoost = hoursSinceCreated <= 24 ? 1.0 : hoursSinceCreated <= 72 ? 0.5 : 0.0;

    // Log-scaled view count, capped at 1.0 around POPULARITY_VIEW_CAP.
    const popularityScore = Math.min(
      1.0,
      Math.log(viewCount + 1) / Math.log(POPULARITY_VIEW_CAP + 1),
    );

    // Deterministic per user-per-day-per-event nudge — see RANDOM_WEIGHT.
    const randomNudge = seededRandom(`${userId}:${today}:${event.id}`);

    const score =
      3.0 * interestRelevance +
      2.0 * timeProximity +
      4.0 * friendRsvpScore +
      1.0 * orgAffinity +
      1.0 * recencyBoost +
      POPULARITY_WEIGHT * popularityScore +
      RANDOM_WEIGHT * randomNudge;

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      orgId: event.orgId,
      orgName: event.orgName,
      datetime: formatEventDateTime(event.datetime),
      location: event.locationName ?? "TBD",
      tags: tagNames,
      flyerUrl: event.flyerUrl,
      rsvpCount,
      friendsAttending,
      isRsvped: userRsvpEventIds.has(event.id),
      isSaved: userSaveEventIds.has(event.id),
      score,
      _rawDatetime: event.datetime,
    };
  });

  // Sort by score descending; ties break by soonest first, so refreshing
  // with no new data never reorders the feed.
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._rawDatetime.getTime() - b._rawDatetime.getTime();
  });

  // Cap events per org
  const ranked = diversifyByOrg(enriched, ORG_DIVERSITY_CAP);

  // Guarantee SOON_QUOTA imminent events land within the first
  // SOON_INJECTION_WINDOW positions. This finalizes ONE stable order over
  // the whole pool before pagination, so every page is a plain slice of
  // the same array — no event can be duplicated or dropped across pages.
  // See docs/ranking.md.
  const isSoon = (e: (typeof ranked)[number]) =>
    (e._rawDatetime.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= SOON_WINDOW_DAYS;

  const windowSize = Math.min(SOON_INJECTION_WINDOW, ranked.length);
  const front = ranked.slice(0, windowSize);
  const tail = ranked.slice(windowSize);

  let finalOrder = ranked;
  const soonInFront = front.filter(isSoon).length;

  if (soonInFront < SOON_QUOTA) {
    const frontIds = new Set(front.map((e) => e.id));
    const missingSoon = tail
      .filter((e) => isSoon(e) && !frontIds.has(e.id))
      .slice(0, SOON_QUOTA - soonInFront);

    if (missingSoon.length > 0) {
      const missingIds = new Set(missingSoon.map((e) => e.id));
      const mergedFront = [...front];
      const stride = Math.max(1, Math.floor(mergedFront.length / (missingSoon.length + 1)));
      missingSoon.forEach((event, i) => {
        mergedFront.splice(Math.min(mergedFront.length, stride * (i + 1)), 0, event);
      });
      finalOrder = [...mergedFront, ...tail.filter((e) => !missingIds.has(e.id))];
    }
  }

  // finalOrder.length === ranked.length always — pure reorder, nothing
  // added or dropped. Pagination is a plain slice of this one stable order.
  const page = finalOrder.slice(offset, offset + limit);

  return {
    events: page.map(({ score: _score, _rawDatetime, ...event }) => event),
    total,
  };
}

export async function toggleRsvp(eventId: string): Promise<{ rsvped: boolean; count: number }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // If the event doesn't exist in the DB (e.g. a demo/local-only event), no-op
  const [eventRow] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!eventRow) {
    // Return zero count and no-op rsvp change to avoid FK constraint errors
    return { rsvped: false, count: 0 };
  }

  const [existing] = await db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, eventId)))
    .limit(1);

  if (existing) {
    await db.delete(rsvps).where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, eventId)));
  } else {
    await db.insert(rsvps).values({ userId, eventId });
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId));

  revalidatePath("/explore");

  return {
    rsvped: !existing,
    count: countResult?.count ?? 0,
  };
}

export async function toggleSave(eventId: string): Promise<{ saved: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // If the event doesn't exist in the DB (e.g. demo/local-only event), no-op
  const [eventRow] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!eventRow) {
    return { saved: false };
  }

  const [existing] = await db
    .select()
    .from(savedEvents)
    .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)))
    .limit(1);

  if (existing) {
    await db
      .delete(savedEvents)
      .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)));
  } else {
    await db.insert(savedEvents).values({ userId, eventId });
  }

  revalidatePath("/explore");

  return { saved: !existing };
}

// ── Event CRUD ────────────────────────────────────────────

export interface EventDetail {
  id: string;
  title: string;
  description: string;
  datetime: Date;
  endDatetime: Date | null;
  locationId: string;
  locationName: string;
  orgId: string | null;
  orgName: string | null;
  creatorId: string;
  creatorName: string;
  flyerUrl: string | null;
  externalLink: string | null;
  isPublic: boolean;
  tags: string[];
  rsvpCount: number;
  attendees: { id: string; displayName: string; avatarUrl: string | null }[];
  friendsAttending: { id: string; displayName: string; avatarUrl: string | null }[];
  isRsvped: boolean;
  isSaved: boolean;
  isOwner: boolean;
}

export async function getEvent(eventId: string): Promise<EventDetail | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      endDatetime: events.endDatetime,
      locationId: events.locationId,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
      creatorId: events.creatorId,
      creatorName: users.displayName,
      flyerUrl: events.flyerUrl,
      externalLink: events.externalLink,
      isPublic: events.isPublic,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .innerJoin(users, eq(events.creatorId, users.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return null;

  // Get tags
  const tags = await db
    .select({ tag: eventTags.tag })
    .from(eventTags)
    .where(eq(eventTags.eventId, eventId));

  // Get RSVP count + attendees
  const attendees = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(rsvps)
    .innerJoin(users, eq(rsvps.userId, users.id))
    .where(eq(rsvps.eventId, eventId));

  // Get friend IDs
  const friendRows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted")));
  const reverseFriendRows = await db
    .select({ friendId: friendships.userId })
    .from(friendships)
    .where(and(eq(friendships.friendId, userId), eq(friendships.status, "accepted")));
  const friendIdSet = new Set([
    ...friendRows.map((f) => f.friendId),
    ...reverseFriendRows.map((f) => f.friendId),
  ]);

  const friendsAttending = attendees.filter((a) => friendIdSet.has(a.id));

  // Check user RSVP + save
  const [userRsvp] = await db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, eventId)))
    .limit(1);

  const [userSave] = await db
    .select()
    .from(savedEvents)
    .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)))
    .limit(1);

  // Similar events (same tags or same org)
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    datetime: event.datetime,
    endDatetime: event.endDatetime,
    locationId: event.locationId,
    locationName: event.locationName ?? "TBD",
    orgId: event.orgId,
    orgName: event.orgName,
    creatorId: event.creatorId,
    creatorName: event.creatorName,
    flyerUrl: event.flyerUrl,
    externalLink: event.externalLink,
    isPublic: event.isPublic,
    tags: tags.map((t) => t.tag),
    rsvpCount: attendees.length,
    attendees,
    friendsAttending,
    isRsvped: !!userRsvp,
    isSaved: !!userSave,
    isOwner: event.creatorId === userId,
  };
}

export async function getSimilarEvents(
  eventId: string,
  tags: string[],
  orgId: string | null,
): Promise<FeedEvent[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const conditions = [gt(events.datetime, new Date())];

  // Events with matching tags or same org, excluding current event
  const tagFilter =
    tags.length > 0
      ? inArray(
          events.id,
          db
            .select({ eventId: eventTags.eventId })
            .from(eventTags)
            .where(inArray(eventTags.tag, tags as (typeof eventTags.$inferSelect.tag)[])),
        )
      : undefined;

  const orgFilter = orgId ? eq(events.orgId, orgId) : undefined;

  const matchFilter = tagFilter && orgFilter ? or(tagFilter, orgFilter) : (tagFilter ?? orgFilter);

  if (matchFilter) {
    conditions.push(matchFilter);
  }

  const rawEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(...conditions, sql`${events.id} != ${eventId}`))
    .orderBy(events.datetime)
    .limit(4);

  return rawEvents.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    orgId: event.orgId,
    orgName: event.orgName,
    datetime: formatEventDateTime(event.datetime),
    location: event.locationName ?? "TBD",
    tags: [],
    flyerUrl: event.flyerUrl,
    rsvpCount: 0,
    friendsAttending: [],
    isRsvped: false,
    isSaved: false,
  }));
}

type EventTagValue = typeof eventTags.$inferSelect.tag;

export async function createEvent(data: {
  title: string;
  description: string;
  datetime: string;
  endDatetime?: string;
  locationId: string;
  orgId?: string;
  tags: string[];
  flyerUrl?: string;
  coverPreset?: string;
  externalLink?: string;
  isPublic?: boolean;
  status?: "draft" | "published";
}): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const creatorId = session.user.id;

  if (data.orgId) {
    const [membership] = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, data.orgId),
          eq(orgMembers.userId, creatorId),
          inArray(orgMembers.role, ["owner", "officer"]),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new Error("Not authorized to create events for this organization");
    }
  }

  const [event] = await db
    .insert(events)
    .values({
      title: data.title,
      description: data.description,
      datetime: new Date(data.datetime),
      endDatetime: data.endDatetime ? new Date(data.endDatetime) : null,
      locationId: data.locationId,
      orgId: data.orgId ?? null,
      creatorId,
      flyerUrl: data.flyerUrl ?? null,
      coverPreset: data.coverPreset ?? null,
      externalLink: data.externalLink ?? null,
      isPublic: data.isPublic ?? true,
      status: data.status ?? "published",
    })
    .returning({ id: events.id });

  if (!event) throw new Error("Failed to create event");

  // Insert tags
  if (data.tags.length > 0) {
    await db.insert(eventTags).values(
      data.tags.map((tag) => ({
        eventId: event.id,
        tag: tag as EventTagValue,
      })),
    );
  }

  // Notify org followers about new event (exclude creator) — only for published events
  if (data.orgId && (data.status ?? "published") === "published") {
    const followers = await db
      .select({ userId: orgFollowers.userId })
      .from(orgFollowers)
      .where(and(eq(orgFollowers.orgId, data.orgId), ne(orgFollowers.userId, creatorId)));

    if (followers.length > 0) {
      await db.insert(notifications).values(
        followers.map((f) => ({
          userId: f.userId,
          type: "org_new_event" as const,
          payload: { eventId: event.id, eventTitle: data.title, orgId: data.orgId },
        })),
      );
    }
  }

  revalidatePath("/explore");
  revalidatePath("/events");

  return { id: event.id };
}

export async function updateEvent(
  eventId: string,
  data: {
    title: string;
    description: string;
    datetime: string;
    endDatetime?: string;
    locationId: string;
    tags: string[];
    flyerUrl?: string;
    externalLink?: string;
    isPublic?: boolean;
  },
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify ownership
  const [event] = await db
    .select({ creatorId: events.creatorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event || event.creatorId !== session.user.id) {
    throw new Error("Not authorized to edit this event");
  }

  await db
    .update(events)
    .set({
      title: data.title,
      description: data.description,
      datetime: new Date(data.datetime),
      endDatetime: data.endDatetime ? new Date(data.endDatetime) : null,
      locationId: data.locationId,
      flyerUrl: data.flyerUrl ?? null,
      externalLink: data.externalLink ?? null,
      isPublic: data.isPublic ?? true,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  // Replace tags
  await db.delete(eventTags).where(eq(eventTags.eventId, eventId));
  if (data.tags.length > 0) {
    await db.insert(eventTags).values(
      data.tags.map((tag) => ({
        eventId,
        tag: tag as EventTagValue,
      })),
    );
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/explore");
  revalidatePath("/events");
}

export async function deleteEvent(eventId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [event] = await db
    .select({ creatorId: events.creatorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event || event.creatorId !== session.user.id) {
    throw new Error("Not authorized to delete this event");
  }

  await db.delete(events).where(eq(events.id, eventId));

  revalidatePath("/explore");
  revalidatePath("/events");
}

export async function getMyEvents(): Promise<{
  created: FeedEvent[];
  rsvped: FeedEvent[];
  saved: FeedEvent[];
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Events the user created
  const createdEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(eq(events.creatorId, userId))
    .orderBy(events.datetime);

  // Events the user RSVP'd to
  const rsvpedEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
    })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(eq(rsvps.userId, userId))
    .orderBy(events.datetime);

  // Events the user saved
  const savedEventsResult = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
    })
    .from(savedEvents)
    .innerJoin(events, eq(savedEvents.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(eq(savedEvents.userId, userId))
    .orderBy(events.datetime);

  const mapEvent = (e: (typeof createdEvents)[0]): FeedEvent => ({
    id: e.id,
    title: e.title,
    description: e.description,
    orgId: e.orgId,
    orgName: e.orgName,
    datetime: formatEventDateTime(e.datetime),
    location: e.locationName ?? "TBD",
    tags: [],
    flyerUrl: e.flyerUrl,
    rsvpCount: 0,
    friendsAttending: [],
    isRsvped: false,
    isSaved: false,
  });

  return {
    created: createdEvents.map(mapEvent),
    rsvped: rsvpedEvents.map(mapEvent),
    saved: savedEventsResult.map(mapEvent),
  };
}

export async function getCampusLocations(): Promise<
  { id: string; name: string; category: string }[]
> {
  return db
    .select({
      id: campusLocations.id,
      name: campusLocations.name,
      category: campusLocations.category,
    })
    .from(campusLocations)
    .orderBy(campusLocations.name);
}

export async function getSavedEvents(): Promise<FeedEvent[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const saved = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
    })
    .from(savedEvents)
    .innerJoin(events, eq(savedEvents.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(eq(savedEvents.userId, userId))
    .orderBy(events.datetime)
    .limit(5);

  return saved.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    orgId: event.orgId,
    orgName: event.orgName,
    datetime: formatEventDateTime(event.datetime),
    location: event.locationName ?? "TBD",
    tags: [],
    flyerUrl: event.flyerUrl,
    rsvpCount: 0,
    friendsAttending: [],
    isRsvped: false,
    isSaved: true,
  }));
}

export interface FriendsEvent extends FeedEvent {
  friendCount: number;
}

export async function getFriendsEvents(): Promise<FriendsEvent[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Get friend IDs (bidirectional)
  const friendRows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted")));
  const reverseFriendRows = await db
    .select({ friendId: friendships.userId })
    .from(friendships)
    .where(and(eq(friendships.friendId, userId), eq(friendships.status, "accepted")));
  const friendIds = [
    ...friendRows.map((f) => f.friendId),
    ...reverseFriendRows.map((f) => f.friendId),
  ];

  if (friendIds.length === 0) return [];

  // Find upcoming events where friends have RSVP'd, with friend count
  const friendsEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      datetime: events.datetime,
      flyerUrl: events.flyerUrl,
      locationName: campusLocations.name,
      orgId: events.orgId,
      orgName: organizations.name,
      friendCount: sql<number>`count(distinct ${rsvps.userId})::int`.as("friend_count"),
    })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(inArray(rsvps.userId, friendIds), gt(events.datetime, new Date())))
    .groupBy(
      events.id,
      events.title,
      events.datetime,
      events.flyerUrl,
      events.orgId,
      campusLocations.name,
      organizations.name,
    )
    .orderBy(desc(sql`friend_count`), events.datetime)
    .limit(20);

  return friendsEvents.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    orgId: event.orgId,
    orgName: event.orgName,
    datetime: formatEventDateTime(event.datetime),
    location: event.locationName ?? "TBD",
    tags: [],
    flyerUrl: event.flyerUrl,
    rsvpCount: 0,
    friendsAttending: [],
    isRsvped: false,
    isSaved: false,
    friendCount: event.friendCount,
  }));
}
