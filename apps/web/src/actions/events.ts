"use server";

import {
  events,
  and,
  campusLocations,
  db,
  desc,
  eq,
  eventTags,
  gt,
  inArray,
  ne,
  notifications,
  or,
  orgFollowers,
  orgMembers,
  organizations,
  rsvps,
  savedEvents,
  sql,
  users,
} from "@the-forum/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "~/auth";
import { formatEventDateTime } from "~/lib/date-format";
import {
  canEditEvent,
  canViewEvent,
  eventDiscoverableBy,
  eventEditableBy,
  eventVisibleTo,
  notFromHiddenOrg,
} from "~/lib/event-visibility";
import { type FeedPage, loadRankedFeed } from "~/lib/feed";
import { loadOrgViewerState } from "~/lib/org-preferences";
import { enforceRateLimit } from "~/lib/rate-limit";
import { isOurImageUrl, uploadedImageUrlSchema } from "~/lib/s3";
import { loadFriendIds } from "~/lib/social-graph";
import {
  dateInputSchema,
  eventStatusSchema,
  eventTagSchema,
  feedSortSchema,
  httpsUrlSchema,
  idSchema,
  locationIdSchema,
  orgCategorySchema,
  parseInput,
  uniqueEnumArray,
} from "~/lib/validation";

export interface FeedEvent {
  id: string;
  title: string;
  description: string | null;
  orgId: string | null;
  orgName: string | null;
  /** Organization logo (MyPrincetonU groups often have one), else null. */
  orgLogoUrl?: string | null;
  /** The viewer follows the host org — drives the card menu's Follow/Unfollow. Explore only. */
  isFollowingOrg?: boolean;
  datetime: string;
  /** ISO timestamp, for building calendar links client-side. */
  rawDatetime?: string;
  location: string;
  /** Room or free-text place within the venue, e.g. "Room 207". */
  locationDetail?: string | null;
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

const feedParamsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  tags: z.array(eventTagSchema).max(eventTagSchema.options.length).optional(),
  orgCategory: orgCategorySchema.optional(),
  locationId: z.string().max(100).optional(),
  dateRange: z.enum(["today", "week", "month"]).optional(),
  sort: feedSortSchema.default("foryou"),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(5000).default(0),
  asOf: z.iso.datetime().optional(),
});

/** Loosely typed on purpose — the schema above is what actually validates it. */
export interface FeedParams {
  search?: string;
  tags?: string[];
  orgCategory?: string;
  locationId?: string;
  dateRange?: "today" | "week" | "month";
  /** "foryou" (default) | "soonest" | "recent". */
  sort?: string;
  limit?: number;
  offset?: number;
  asOf?: string;
}

/**
 * One page of the Explore feed in the requested sort. Ordering (for "For you":
 * ranking, org-diversity and the soon-event quota) is applied to the whole
 * candidate list before paginating; see `~/lib/feed.ts` and docs/ranking.md.
 *
 * Pass the returned `asOf` and `nextOffset` back for the next page so later
 * pages are slices of the same ordering.
 */
export async function getFeedEvents(params?: FeedParams): Promise<FeedPage> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const input = parseInput(feedParamsSchema, params ?? {});

  return loadRankedFeed(session.user.id, {
    search: input.search || undefined,
    tags: input.tags,
    orgCategory: input.orgCategory,
    locationId: input.locationId,
    dateRange: input.dateRange,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset,
    asOf: input.asOf ? new Date(input.asOf) : undefined,
  });
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
  const id = parseInput(idSchema, eventId);

  // Missing, draft or private events the viewer can't see: no-op, exactly as
  // if the event didn't exist (so this can't be used to probe for them).
  if (!(await canViewEvent(id, userId))) {
    return { rsvped: false, count: 0, attendees: [] };
  }

  const [existing] = await db
    .select({ eventId: rsvps.eventId })
    .from(rsvps)
    .where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, id)))
    .limit(1);

  // Both branches are idempotent, so a double-click (two concurrent toggles
  // that both read "not RSVP'd") converges instead of throwing on the PK.
  if (existing) {
    await db.delete(rsvps).where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, id)));
  } else {
    await db.insert(rsvps).values({ userId, eventId: id }).onConflictDoNothing();
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
    .where(eq(rsvps.eventId, id));

  revalidatePath("/explore");

  return {
    rsvped: attendees.some((a) => a.id === userId),
    count: attendees.length,
    attendees,
  };
}

export async function toggleSave(eventId: string): Promise<{ saved: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const id = parseInput(idSchema, eventId);

  // Missing or not visible to this viewer: no-op.
  if (!(await canViewEvent(id, userId))) {
    return { saved: false };
  }

  const [existing] = await db
    .select({ eventId: savedEvents.eventId })
    .from(savedEvents)
    .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, id)))
    .limit(1);

  // Idempotent either way — see toggleRsvp.
  if (existing) {
    await db
      .delete(savedEvents)
      .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, id)));
  } else {
    await db.insert(savedEvents).values({ userId, eventId: id }).onConflictDoNothing();
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
  orgLogoUrl: string | null;
  creatorId: string;
  creatorName: string;
  flyerUrl: string | null;
  externalLink: string | null;
  isPublic: boolean;
  /** 'manual', or where an imported event came from: 'myprincetonu' | 'listserv'. */
  source: string;
  sourceUrl: string | null;
  /** Room or free-text place, e.g. "Room 104". */
  locationDetail: string | null;
  tags: string[];
  rsvpCount: number;
  attendees: { id: string; displayName: string; avatarUrl: string | null }[];
  friendsAttending: { id: string; displayName: string; avatarUrl: string | null }[];
  isRsvped: boolean;
  isSaved: boolean;
  /** The viewer created this event (may delete it). */
  isOwner: boolean;
  /** The viewer may edit it: creator, or owner/officer of its org. */
  canEdit: boolean;
  /** The viewer follows the host org. */
  isFollowingOrg: boolean;
  /** The viewer hid the host org's events from discovery. */
  isOrgHidden: boolean;
}

export async function getEvent(eventId: string): Promise<EventDetail | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Not a well-formed id → not found (rather than a Postgres cast error).
  if (!idSchema.safeParse(eventId).success) return null;

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
      orgLogoUrl: organizations.logoUrl,
      creatorId: events.creatorId,
      creatorName: users.displayName,
      flyerUrl: events.flyerUrl,
      externalLink: events.externalLink,
      isPublic: events.isPublic,
      source: events.source,
      sourceUrl: events.sourceUrl,
      locationDetail: events.locationDetail,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .innerJoin(users, eq(events.creatorId, users.id))
    // Drafts and private events 404 for anyone who isn't allowed to see them.
    .where(and(eq(events.id, eventId), eventVisibleTo(userId)))
    .limit(1);

  if (!event) return null;

  const [friendIds, canEdit, orgState] = await Promise.all([
    loadFriendIds(userId),
    event.creatorId === userId ? Promise.resolve(true) : canEditEvent(eventId, userId),
    event.orgId ? loadOrgViewerState(userId, event.orgId) : null,
  ]);
  const extra = await loadEventEnrichment([eventId], userId, friendIds);
  const attendees = extra.attendees.get(eventId) ?? [];

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
    orgLogoUrl: event.orgLogoUrl ?? null,
    creatorId: event.creatorId,
    creatorName: event.creatorName,
    flyerUrl: event.flyerUrl,
    externalLink: event.externalLink,
    isPublic: event.isPublic,
    source: event.source,
    sourceUrl: event.sourceUrl,
    locationDetail: event.locationDetail,
    tags: extra.tags.get(eventId) ?? [],
    rsvpCount: attendees.length,
    attendees,
    friendsAttending: extra.friends.get(eventId) ?? [],
    isRsvped: extra.rsvpedByMe.has(eventId),
    isSaved: extra.savedByMe.has(eventId),
    isOwner: event.creatorId === userId,
    canEdit,
    isFollowingOrg: orgState?.following ?? false,
    isOrgHidden: orgState?.hidden ?? false,
  };
}

const similarEventsSchema = z.object({
  eventId: idSchema,
  tags: z.array(eventTagSchema).max(eventTagSchema.options.length),
  orgId: idSchema.nullable(),
});

export async function getSimilarEvents(
  eventId: string,
  tags: string[],
  orgId: string | null,
): Promise<FeedEvent[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const input = parseInput(similarEventsSchema, { eventId, tags, orgId });

  const conditions = [
    gt(events.datetime, new Date()),
    eventDiscoverableBy(userId),
    notFromHiddenOrg(userId),
    ne(events.id, input.eventId),
  ];

  // Events with matching tags or same org, excluding current event
  const tagFilter =
    input.tags.length > 0
      ? inArray(
          events.id,
          db
            .select({ eventId: eventTags.eventId })
            .from(eventTags)
            .where(inArray(eventTags.tag, input.tags)),
        )
      : undefined;

  const orgFilter = input.orgId ? eq(events.orgId, input.orgId) : undefined;

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
      orgLogoUrl: organizations.logoUrl,
      locationDetail: events.locationDetail,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(...conditions))
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
      orgLogoUrl: event.orgLogoUrl ?? null,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      locationDetail: event.locationDetail ?? null,
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

/** Fields shared by create and update. */
const eventFieldsSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }).max(200),
  description: z.string().trim().max(20_000),
  datetime: dateInputSchema,
  endDatetime: dateInputSchema.nullish(),
  locationId: locationIdSchema,
  tags: uniqueEnumArray(eventTagSchema).default([]),
  externalLink: httpsUrlSchema,
  isPublic: z.boolean().default(true),
});

type EventFields = z.output<typeof eventFieldsSchema>;

function endNotBeforeStart(data: Pick<EventFields, "datetime" | "endDatetime">) {
  return !data.endDatetime || data.endDatetime.getTime() >= data.datetime.getTime();
}
const END_BEFORE_START = {
  message: "End time must be after the start time",
  path: ["endDatetime"],
};

const createEventSchema = eventFieldsSchema
  .extend({
    orgId: idSchema.nullish(),
    flyerUrl: uploadedImageUrlSchema("event-flyers"),
    coverPreset: z
      .string()
      .max(50)
      .regex(/^[a-z0-9-]+$/)
      .nullish(),
    status: eventStatusSchema.default("published"),
  })
  .refine(endNotBeforeStart, END_BEFORE_START);

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
  const input = parseInput(createEventSchema, data);
  enforceRateLimit("createEvent", creatorId);

  if (input.orgId) {
    const [membership] = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, creatorId),
          inArray(orgMembers.role, ["owner", "officer"]),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new Error("Not authorized to create events for this organization");
    }
  }

  // Event + tags commit together, so a failure can't leave an untagged event.
  const eventId = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        title: input.title,
        description: input.description,
        datetime: input.datetime,
        endDatetime: input.endDatetime ?? null,
        locationId: input.locationId,
        orgId: input.orgId ?? null,
        creatorId,
        flyerUrl: input.flyerUrl,
        coverPreset: input.coverPreset ?? null,
        externalLink: input.externalLink,
        isPublic: input.isPublic,
        status: input.status,
      })
      .returning({ id: events.id });

    if (!event) throw new Error("Failed to create event");

    if (input.tags.length > 0) {
      await tx
        .insert(eventTags)
        .values(input.tags.map((tag) => ({ eventId: event.id, tag })))
        .onConflictDoNothing();
    }
    return event.id;
  });

  // Notify org followers about new event (exclude creator) — only for events
  // followers can actually open: published AND public.
  if (input.orgId && input.status === "published" && input.isPublic) {
    const followers = await db
      .select({ userId: orgFollowers.userId })
      .from(orgFollowers)
      .where(and(eq(orgFollowers.orgId, input.orgId), ne(orgFollowers.userId, creatorId)));

    if (followers.length > 0) {
      await db.insert(notifications).values(
        followers.map((f) => ({
          userId: f.userId,
          type: "org_new_event" as const,
          payload: { eventId, eventTitle: input.title, orgId: input.orgId },
        })),
      );
    }
  }

  revalidatePath("/explore");
  revalidatePath("/events");

  return { id: eventId };
}

const updateEventSchema = eventFieldsSchema
  .extend({
    // Checked against the event's current flyer below: an unchanged flyer is
    // always accepted (it may predate uploads, e.g. listserv-ingested events);
    // a new one must be one of our uploads.
    flyerUrl: z
      .string()
      .trim()
      .max(2048)
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .refine(endNotBeforeStart, END_BEFORE_START);

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

  const userId = session.user.id;
  const id = parseInput(idSchema, eventId);
  const input = parseInput(updateEventSchema, data);

  // Creator, or owner/officer of the event's org.
  const [event] = await db
    .select({ flyerUrl: events.flyerUrl })
    .from(events)
    .where(and(eq(events.id, id), eventEditableBy(userId)))
    .limit(1);

  if (!event) {
    throw new Error("Not authorized to edit this event");
  }

  if (
    input.flyerUrl !== null &&
    input.flyerUrl !== event.flyerUrl &&
    !isOurImageUrl(input.flyerUrl, "event-flyers")
  ) {
    throw new Error("Invalid input — flyerUrl: Image must be uploaded through The Forum");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(events)
      .set({
        title: input.title,
        description: input.description,
        datetime: input.datetime,
        endDatetime: input.endDatetime ?? null,
        locationId: input.locationId,
        flyerUrl: input.flyerUrl,
        externalLink: input.externalLink,
        isPublic: input.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id));

    // Replace tags
    await tx.delete(eventTags).where(eq(eventTags.eventId, id));
    if (input.tags.length > 0) {
      await tx
        .insert(eventTags)
        .values(input.tags.map((tag) => ({ eventId: id, tag })))
        .onConflictDoNothing();
    }
  });

  revalidatePath(`/events/${id}`);
  revalidatePath("/explore");
  revalidatePath("/events");
}

export async function deleteEvent(eventId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = parseInput(idSchema, eventId);

  const [event] = await db
    .select({ creatorId: events.creatorId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!event || event.creatorId !== session.user.id) {
    throw new Error("Not authorized to delete this event");
  }

  await db.delete(events).where(eq(events.id, id));

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
      orgLogoUrl: organizations.logoUrl,
      locationDetail: events.locationDetail,
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
      orgLogoUrl: organizations.logoUrl,
      locationDetail: events.locationDetail,
    })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    // An RSVP'd event that has since been unpublished or made private drops out.
    .where(and(eq(rsvps.userId, userId), eventVisibleTo(userId)))
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
      orgLogoUrl: organizations.logoUrl,
      locationDetail: events.locationDetail,
    })
    .from(savedEvents)
    .innerJoin(events, eq(savedEvents.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(eq(savedEvents.userId, userId), eventVisibleTo(userId)))
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
      orgLogoUrl: e.orgLogoUrl ?? null,
      datetime: formatEventDateTime(e.datetime),
      rawDatetime: e.datetime.toISOString(),
      location: e.locationName ?? "TBD",
      locationDetail: e.locationDetail ?? null,
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
      orgLogoUrl: organizations.logoUrl,
      locationDetail: events.locationDetail,
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
    .where(
      and(eq(savedEvents.userId, userId), gt(events.datetime, new Date()), eventVisibleTo(userId)),
    )
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
      orgLogoUrl: event.orgLogoUrl ?? null,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      locationDetail: event.locationDetail ?? null,
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

  const friendIds = await loadFriendIds(userId);
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
      orgLogoUrl: organizations.logoUrl,
      locationDetail: events.locationDetail,
      friendCount: sql<number>`count(distinct ${rsvps.userId})::int`.as("friend_count"),
    })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    // A friend's RSVP to a draft/private event must not leak it to the viewer.
    .where(
      and(
        inArray(rsvps.userId, friendIds),
        gt(events.datetime, new Date()),
        eventDiscoverableBy(userId),
        notFromHiddenOrg(userId),
      ),
    )
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
      orgLogoUrl: event.orgLogoUrl ?? null,
      datetime: formatEventDateTime(event.datetime),
      rawDatetime: event.datetime.toISOString(),
      location: event.locationName ?? "TBD",
      locationDetail: event.locationDetail ?? null,
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
