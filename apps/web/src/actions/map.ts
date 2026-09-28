"use server";

import {
  events,
  and,
  campusLocations,
  db,
  eq,
  eventTags,
  gte,
  inArray,
  lt,
  ne,
  or,
  organizations,
  rsvps,
  users,
} from "@the-forum/database";
import { z } from "zod";
import { auth } from "~/auth";
import { formatTime } from "~/lib/date-format";
import { eventDiscoverableBy, notFromHiddenOrg } from "~/lib/event-visibility";
import { loadFriendIds } from "~/lib/social-graph";
import { dateInputSchema, parseInput } from "~/lib/validation";

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

const mapEventsSchema = z.object({
  from: dateInputSchema.optional(),
  days: z.number().int().min(1).max(31).default(7),
});

/** Fetch events for a date range (defaults to next 7 days). */
export async function getMapEvents(opts?: {
  from?: string;
  days?: number;
}): Promise<MapEvent[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const input = parseInput(mapEventsSchema, opts ?? {});

  const friendIds = await loadFriendIds(userId);

  const startDate = input.from ?? new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + input.days);
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
    .where(
      and(
        gte(events.datetime, startDate),
        lt(events.datetime, endDate),
        // Published AND visible to this viewer — see ~/lib/event-visibility.ts.
        eventDiscoverableBy(userId),
        // Not from an org the viewer hid.
        notFromHiddenOrg(userId),
        // The "other" placeholder location sits at (0, 0) — off the coast of
        // Africa. Events there have no real coordinates, so keep them off the map.
        or(ne(campusLocations.latitude, 0), ne(campusLocations.longitude, 0)),
      ),
    )
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
    datetime: formatTime(r.datetime),
    tags: tagsByEvent.get(r.id) ?? [],
  }));
}
