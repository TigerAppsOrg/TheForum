"use server";

import {
  events,
  and,
  campusLocations,
  db,
  eq,
  eventTags,
  friendships,
  gte,
  inArray,
  lt,
  organizations,
  rsvps,
  users,
} from "@the-forum/database";
import { auth } from "~/auth";

export interface MapEvent {
  id: string;
  title: string;
  datetime: string;
  rawDatetime: string; // ISO string for relative time calc
  orgName: string | null;
  flyerUrl: string | null;
  locationId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  tags: string[];
  /** Friends of the viewer who have RSVP'd — the avatar stack on each card. */
  friendsAttending: { id: string; displayName: string; avatarUrl: string | null }[];
}

/** Fetch events for a date range (defaults to next 7 days). */
export async function getMapEvents(opts?: {
  from?: string;
  days?: number;
}): Promise<MapEvent[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Accepted friendships are stored one-directional, so both columns are read.
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
  const friendIds = [...outgoing, ...incoming].map((r) => r.friendId);

  const startDate = opts?.from ? new Date(opts.from) : new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (opts?.days ?? 7));
  endDate.setHours(23, 59, 59, 999);

  const results = await db
    .select({
      id: events.id,
      title: events.title,
      datetime: events.datetime,
      orgName: organizations.name,
      flyerUrl: events.flyerUrl,
      locationId: campusLocations.id,
      locationName: campusLocations.name,
      latitude: campusLocations.latitude,
      longitude: campusLocations.longitude,
    })
    .from(events)
    .innerJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(gte(events.datetime, startDate), lt(events.datetime, endDate)))
    .orderBy(events.datetime);

  /*
   * Tags and friend RSVPs are fetched in one query each and grouped in memory,
   * rather than two queries per event. The per-event version issued 2N+1
   * queries — all fired concurrently via Promise.all — which held a connection
   * each and helped exhaust the pool.
   */
  const eventIds = results.map((r) => r.id);
  if (eventIds.length === 0) return [];

  const [tagRows, friendRsvpRows] = await Promise.all([
    db
      .select({ eventId: eventTags.eventId, tag: eventTags.tag })
      .from(eventTags)
      .where(inArray(eventTags.eventId, eventIds)),
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

  const tagsByEvent = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByEvent.get(row.eventId);
    if (list) list.push(row.tag);
    else tagsByEvent.set(row.eventId, [row.tag]);
  }

  const friendsByEvent = new Map<string, MapEvent["friendsAttending"]>();
  for (const { eventId, ...friend } of friendRsvpRows) {
    const list = friendsByEvent.get(eventId);
    if (list) list.push(friend);
    else friendsByEvent.set(eventId, [friend]);
  }

  return results.map((r) => ({
    ...r,
    friendsAttending: friendsByEvent.get(r.id) ?? [],
    locationId: r.locationId ?? "",
    locationName: r.locationName ?? "TBD",
    rawDatetime: r.datetime.toISOString(),
    datetime: r.datetime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    tags: tagsByEvent.get(r.id) ?? [],
  }));
}
