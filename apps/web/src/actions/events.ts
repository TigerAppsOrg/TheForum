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
  /** ISO timestamp, for building calendar links client-side. */
  rawDatetime?: string;
  location: string;
  tags: string[];
  flyerUrl: string | null;
  rsvpCount: number;
  friendsAttending: { id: string; displayName: string; avatarUrl: string | null }[];
  /**
   * Everyone who has RSVP'd — powers the "N attending" list on each card.
   *
   * Optional because only the Explore feed loads it; the saved/created/friends
   * queries build the same shape without paying for the extra join.
   */
  attendees?: { id: string; displayName: string; avatarUrl: string | null }[];
  isRsvped: boolean;
  isSaved: boolean;
}

/** Accepted friendships are stored one-directional, so both columns are read. */
async function loadFriendIds(userId: string): Promise<string[]> {
  const [outgoing, incoming] = await Promise.all([
    db
      .select({ friendId: friendships.friendId })
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted"))),
    db
      .select({ friendId: friendships.userId })
      .from(friendships)
      .where(and(eq(friendships.friendId, userId), eq(friendships.status, "accepted"))),
  ]);
  return [...outgoing, ...incoming].map((r) => r.friendId);
}

interface EventEnrichment {
  tags: Map<string, string[]>;
  attendees: Map<string, NonNullable<FeedEvent["attendees"]>>;
  friends: Map<string, FeedEvent["friendsAttending"]>;
  rsvpedByMe: Set<string>;
  savedByMe: Set<string>;
}

/**
 * Tags, attendees, friend attendance and the viewer's own RSVP/save state for
 * a page of events.
 *
 * Four call sites were each hard-coding `tags: []`, `rsvpCount: 0`,
 * `friendsAttending: []` and `isRsvped/isSaved: false`, so those screens could
 * never show a tag or the right button state no matter how they were styled.
 *
 * Everything is fetched as one query per field and grouped in memory. The
 * per-event version issued several queries per row, all concurrent, each
 * holding a connection — which is how the pool got exhausted.
 */
async function loadEventEnrichment(
  eventIds: string[],
  userId: string,
  friendIds: string[],
): Promise<EventEnrichment> {
  const empty: EventEnrichment = {
    tags: new Map(),
    attendees: new Map(),
    friends: new Map(),
    rsvpedByMe: new Set(),
    savedByMe: new Set(),
  };
  if (eventIds.length === 0) return empty;

  const [tagRows, attendeeRows, myRsvps, mySaves] = await Promise.all([
    db
      .select({ eventId: eventTags.eventId, tag: eventTags.tag })
      .from(eventTags)
      .where(inArray(eventTags.eventId, eventIds)),
    db
      .select({
        eventId: rsvps.eventId,
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(rsvps)
      .innerJoin(users, eq(rsvps.userId, users.id))
      .where(inArray(rsvps.eventId, eventIds)),
    db
      .select({ eventId: rsvps.eventId })
      .from(rsvps)
      .where(and(inArray(rsvps.eventId, eventIds), eq(rsvps.userId, userId))),
    db
      .select({ eventId: savedEvents.eventId })
      .from(savedEvents)
      .where(and(inArray(savedEvents.eventId, eventIds), eq(savedEvents.userId, userId))),
  ]);

  const friendIdSet = new Set(friendIds);
  const result: EventEnrichment = {
    tags: new Map(),
    attendees: new Map(),
    friends: new Map(),
    rsvpedByMe: new Set(myRsvps.map((r) => r.eventId)),
    savedByMe: new Set(mySaves.map((r) => r.eventId)),
  };

  for (const row of tagRows) {
    const list = result.tags.get(row.eventId);
    if (list) list.push(row.tag);
    else result.tags.set(row.eventId, [row.tag]);
  }

  for (const { eventId, ...person } of attendeeRows) {
    const all = result.attendees.get(eventId);
    if (all) all.push(person);
    else result.attendees.set(eventId, [person]);

    if (friendIdSet.has(person.id)) {
      const mine = result.friends.get(eventId);
      if (mine) mine.push(person);
      else result.friends.set(eventId, [person]);
    }
  }

  return result;
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

  if (params?.dateRange) {
    const now = new Date();
    let end: Date;
    if (params.dateRange === "today") {
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (params.dateRange === "week") {
      end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    conditions.push(lt(events.datetime, end));
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(...conditions));
  const total = countResult?.count ?? 0;

  // Fetch events with scoring
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
    .limit(limit)
    .offset(offset);

  // Enrich each event with tags, rsvp counts, friend attendance, user state
  //
  // Ranking, in plain English: an event scores higher if (1) its tags match
  // your interests, (2) it's happening soon, (3) friends of yours are
  // attending, (4) it belongs to an org you follow or belong to, or (5) it
  // was posted recently. Scores are deterministic — no randomness — so
  // refreshing Explore without new data (RSVPs, new events, etc.) never
  // reorders the feed. Ties break by soonest event first.
  const enriched: (FeedEvent & { score: number; _rawDatetime: Date })[] = await Promise.all(
    rawEvents.map(async (event) => {
      // Get tags
      const tags = await db
        .select({ tag: eventTags.tag })
        .from(eventTags)
        .where(eq(eventTags.eventId, event.id));

      // Get RSVP count
      const [rsvpCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(rsvps)
        .where(eq(rsvps.eventId, event.id));

      // Get friends attending
      let friendsAttending: { id: string; displayName: string; avatarUrl: string | null }[] = [];
      if (friendIds.length > 0) {
        friendsAttending = await db
          .select({
            id: users.id,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          })
          .from(rsvps)
          .innerJoin(users, eq(rsvps.userId, users.id))
          .where(and(eq(rsvps.eventId, event.id), inArray(rsvps.userId, friendIds)));
      }

      // Check if user has RSVP'd or saved
      const [userRsvp] = await db
        .select()
        .from(rsvps)
        .where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, event.id)))
        .limit(1);

      const [userSave] = await db
        .select()
        .from(savedEvents)
        .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, event.id)))
        .limit(1);

      // Score for sorting
      const tagNames = tags.map((t) => t.tag);

      // Fraction of this event's tags that match the user's interests — how
      // relevant is this event to you, not how much of your profile it covers.
      const matchedTags = tagNames.filter((t) => myInterestTags.includes(t)).length;
      const interestRelevance =
        myInterestTags.length === 0
          ? 0.5
          : tagNames.length === 0
            ? 0
            : matchedTags / tagNames.length;

      const now = Date.now();
      const eventTime = event.datetime.getTime();
      const daysUntil = (eventTime - now) / (1000 * 60 * 60 * 24);
      const timeProximity =
        daysUntil <= 1
          ? 1.0
          : daysUntil <= 3
            ? 0.8
            : daysUntil <= 7
              ? 0.6
              : daysUntil <= 14
                ? 0.3
                : 0.1;

      const friendRsvpScore = Math.min(1.0, friendsAttending.length / 3.0);

      const orgAffinity = event.orgId && myOrgIds.has(event.orgId) ? 1.0 : 0.0;

      const hoursSinceCreated = (now - event.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyBoost = hoursSinceCreated <= 24 ? 1.0 : hoursSinceCreated <= 72 ? 0.5 : 0.0;

      const score =
        3.0 * interestRelevance +
        2.0 * timeProximity +
        4.0 * friendRsvpScore +
        1.0 * orgAffinity +
        1.0 * recencyBoost;

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
        rsvpCount: rsvpCount?.count ?? 0,
        friendsAttending,
        isRsvped: !!userRsvp,
        isSaved: !!userSave,
        score,
        _rawDatetime: event.datetime,
      };
    }),
  );

  /*
   * Attendees for the "N attending" control on each card.
   *
   * One query for the whole page rather than one per event — the enrichment
   * above already issues several queries per event, and adding another to that
   * loop is what pushes the connection pool over on a full feed.
   */
  const feedIds = enriched.map((e) => e.id);
  const attendeeRows =
    feedIds.length === 0
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
          .where(inArray(rsvps.eventId, feedIds));

  const attendeesByEvent = new Map<string, FeedEvent["attendees"]>();
  for (const { eventId, ...person } of attendeeRows) {
    const list = attendeesByEvent.get(eventId);
    if (list) list.push(person);
    else attendeesByEvent.set(eventId, [person]);
  }

  // Sort by score descending; ties break by soonest event first, so
  // refreshing Explore with no new data never reorders the feed.
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._rawDatetime.getTime() - b._rawDatetime.getTime();
  });

  return {
    events: enriched.map(({ score: _score, _rawDatetime, ...event }) => ({
      ...event,
      attendees: attendeesByEvent.get(event.id) ?? [],
    })),
    total,
  };
}

/** The attendee shape shared by the feed, the detail page and `toggleRsvp`. */
type Attendee = { id: string; displayName: string; avatarUrl: string | null };

export async function toggleRsvp(eventId: string): Promise<{
  rsvped: boolean;
  count: number;
  /*
   * The full attendee list after the toggle. Callers render an avatar stack
   * from this alongside the count, so returning only the count left the
   * viewer's own face in the stack after they un-RSVP'd.
   */
  attendees: Attendee[];
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // If the event doesn't exist in the DB (e.g. a demo/local-only event), no-op
  const [eventRow] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!eventRow) {
    // Return zero count and no-op rsvp change to avoid FK constraint errors
    return { rsvped: false, count: 0, attendees: [] };
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

  // Re-read the roster rather than counting: the count and the avatar stack are
  // rendered from the same data, so they cannot drift out of step this way.
  const attendees = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(rsvps)
    .innerJoin(users, eq(rsvps.userId, users.id))
    .where(eq(rsvps.eventId, eventId));

  revalidatePath("/explore");

  return {
    rsvped: !existing,
    count: attendees.length,
    attendees,
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

  const userId = session.user.id;

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

  const friendIds = await loadFriendIds(userId);
  const extra = await loadEventEnrichment(
    rawEvents.map((e) => e.id),
    userId,
    friendIds,
  );

  return rawEvents.map((event) => {
    const attendees = extra.attendees.get(event.id) ?? [];
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      orgId: event.orgId,
      orgName: event.orgName,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      tags: extra.tags.get(event.id) ?? [],
      flyerUrl: event.flyerUrl,
      rsvpCount: attendees.length,
      attendees,
      friendsAttending: extra.friends.get(event.id) ?? [],
      isRsvped: extra.rsvpedByMe.has(event.id),
      isSaved: extra.savedByMe.has(event.id),
    };
  });
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

  /*
   * Enrich all three tabs at once. These fields used to be hard-coded, so My
   * Events could never show a tag, a friend, or the correct RSVP state
   * regardless of how the card was styled.
   */
  const allIds = [
    ...new Set([...createdEvents, ...rsvpedEvents, ...savedEventsResult].map((e) => e.id)),
  ];
  const friendIds = await loadFriendIds(userId);
  const extra = await loadEventEnrichment(allIds, userId, friendIds);

  const mapEvent = (e: (typeof createdEvents)[0]): FeedEvent => {
    const attendees = extra.attendees.get(e.id) ?? [];
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      orgId: e.orgId,
      orgName: e.orgName,
      datetime: formatEventDateTime(e.datetime),
      rawDatetime: e.datetime.toISOString(),
      location: e.locationName ?? "TBD",
      tags: extra.tags.get(e.id) ?? [],
      flyerUrl: e.flyerUrl,
      rsvpCount: attendees.length,
      attendees,
      friendsAttending: extra.friends.get(e.id) ?? [],
      isRsvped: extra.rsvpedByMe.has(e.id),
      isSaved: extra.savedByMe.has(e.id),
    };
  };

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
    /*
     * Future events only. "Upcoming Events" reads from this list, and without
     * the datetime bound a saved event from last week surfaced there — with
     * `formatRelativeDay` cheerfully announcing it was happening "yesterday".
     */
    .where(and(eq(savedEvents.userId, userId), gt(events.datetime, new Date())))
    .orderBy(events.datetime)
    .limit(5);

  const friendIds = await loadFriendIds(userId);
  const extra = await loadEventEnrichment(
    saved.map((e) => e.id),
    userId,
    friendIds,
  );

  return saved.map((event) => {
    const attendees = extra.attendees.get(event.id) ?? [];
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      orgId: event.orgId,
      orgName: event.orgName,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      tags: extra.tags.get(event.id) ?? [],
      flyerUrl: event.flyerUrl,
      rsvpCount: attendees.length,
      attendees,
      friendsAttending: extra.friends.get(event.id) ?? [],
      isRsvped: extra.rsvpedByMe.has(event.id),
      // Everything in this list is saved by definition.
      isSaved: true,
    };
  });
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

  const extra = await loadEventEnrichment(
    friendsEvents.map((e) => e.id),
    userId,
    friendIds,
  );

  return friendsEvents.map((event) => {
    const attendees = extra.attendees.get(event.id) ?? [];
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      orgId: event.orgId,
      orgName: event.orgName,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      tags: extra.tags.get(event.id) ?? [],
      flyerUrl: event.flyerUrl,
      rsvpCount: attendees.length,
      attendees,
      friendsAttending: extra.friends.get(event.id) ?? [],
      isRsvped: extra.rsvpedByMe.has(event.id),
      isSaved: extra.savedByMe.has(event.id),
      friendCount: event.friendCount,
    };
  });
}
