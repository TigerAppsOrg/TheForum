import { randomBytes } from "node:crypto";
import {
  events,
  and,
  asc,
  campusLocations,
  db,
  eq,
  gte,
  inArray,
  orgFollowers,
  organizations,
  rsvps,
  savedEvents,
  users,
} from "@the-forum/database";
import { eventDiscoverableBy, eventVisibleTo } from "~/lib/event-visibility";
import { type IcsEvent, buildIcsCalendar } from "~/lib/ics";
import { SITE_URL } from "~/lib/site";

/**
 * Server-only: the user's calendars ("Going", "Saved", one per org) as
 * iCalendar feeds behind a secret per-user token, plus the data the My Events
 * calendar view shows. Visibility always goes through lib/event-visibility.
 */

export type FeedKey =
  | { kind: "going" }
  | { kind: "saved" }
  | { kind: "all" }
  | { kind: "org"; orgId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

/** Feeds keep a little history so just-finished events don't vanish from calendars. */
const HISTORY_DAYS = 60;
const MAX_EVENTS = 1000;

/** "going.ics" | "saved.ics" | "all.ics" | "org-<uuid>.ics" → FeedKey (or null). */
export function parseFeedSlug(slug: string): FeedKey | null {
  const name = slug.replace(/\.ics$/i, "");
  if (name === "going" || name === "saved" || name === "all") return { kind: name };
  const org = name.match(/^org-(.+)$/);
  if (org?.[1] && UUID.test(org[1])) return { kind: "org", orgId: org[1].toLowerCase() };
  return null;
}

export function feedSlug(key: FeedKey): string {
  return key.kind === "org" ? `org-${key.orgId}` : key.kind;
}

export function newCalendarToken() {
  return randomBytes(24).toString("base64url"); // 32 chars, 192 bits
}

export async function findUserIdByCalendarToken(token: string): Promise<string | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.calendarToken, token))
    .limit(1);
  return row?.id ?? null;
}

/** The user's token, creating one on first use. */
export async function ensureCalendarToken(userId: string): Promise<string> {
  const [row] = await db
    .select({ token: users.calendarToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row?.token) return row.token;
  const token = newCalendarToken();
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, userId));
  return token;
}

export async function rotateCalendarToken(userId: string): Promise<string> {
  const token = newCalendarToken();
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, userId));
  return token;
}

export interface FeedEventRow {
  id: string;
  title: string;
  description: string;
  datetime: Date;
  endDatetime: Date | null;
  updatedAt: Date;
  locationName: string | null;
  locationDetail: string | null;
  orgId: string | null;
  orgName: string | null;
}

const columns = {
  id: events.id,
  title: events.title,
  description: events.description,
  datetime: events.datetime,
  endDatetime: events.endDatetime,
  updatedAt: events.updatedAt,
  locationName: campusLocations.name,
  locationDetail: events.locationDetail,
  orgId: events.orgId,
  orgName: organizations.name,
};

function since(from?: Date) {
  return from ?? new Date(Date.now() - HISTORY_DAYS * 86_400_000);
}

export async function eventsForIds(userId: string, ids: string[], from?: Date) {
  if (ids.length === 0) return [];
  return db
    .select(columns)
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(and(inArray(events.id, ids), eventVisibleTo(userId), gte(events.datetime, since(from))))
    .orderBy(asc(events.datetime))
    .limit(MAX_EVENTS);
}

/** Every published event of these orgs that the user may discover. */
export async function orgEvents(userId: string, orgIds: string[], from?: Date) {
  if (orgIds.length === 0) return [];
  return db
    .select(columns)
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .leftJoin(organizations, eq(events.orgId, organizations.id))
    .where(
      and(
        inArray(events.orgId, orgIds),
        eventDiscoverableBy(userId),
        gte(events.datetime, since(from)),
      ),
    )
    .orderBy(asc(events.datetime))
    .limit(MAX_EVENTS);
}

export async function rsvpedEventIds(userId: string) {
  const rows = await db.select({ id: rsvps.eventId }).from(rsvps).where(eq(rsvps.userId, userId));
  return rows.map((r) => r.id);
}

export async function savedEventIds(userId: string) {
  const rows = await db
    .select({ id: savedEvents.eventId })
    .from(savedEvents)
    .where(eq(savedEvents.userId, userId));
  return rows.map((r) => r.id);
}

export async function followedOrgs(userId: string) {
  return db
    .select({ id: organizations.id, name: organizations.name, logoUrl: organizations.logoUrl })
    .from(orgFollowers)
    .innerJoin(organizations, eq(orgFollowers.orgId, organizations.id))
    .where(eq(orgFollowers.userId, userId))
    .orderBy(asc(organizations.name));
}

export async function orgName(orgId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return row?.name ?? null;
}

function dedupeSorted(rows: FeedEventRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  return [...byId.values()].sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
}

/** Events in one feed, for the token owner. Returns null for an unknown org. */
export async function loadFeed(
  userId: string,
  key: FeedKey,
): Promise<{ name: string; description: string; events: FeedEventRow[] } | null> {
  switch (key.kind) {
    case "going":
      return {
        name: "Forum · Going",
        description: "Events you've RSVP'd to on The Forum",
        events: await eventsForIds(userId, await rsvpedEventIds(userId)),
      };
    case "saved":
      return {
        name: "Forum · Saved",
        description: "Events you've saved on The Forum",
        events: await eventsForIds(userId, await savedEventIds(userId)),
      };
    case "org": {
      const name = await orgName(key.orgId);
      if (!name) return null;
      return {
        name: `${name} · Forum`,
        description: `Upcoming events from ${name}, via The Forum`,
        events: await orgEvents(userId, [key.orgId]),
      };
    }
    case "all": {
      const [going, saved, orgs] = await Promise.all([
        rsvpedEventIds(userId),
        savedEventIds(userId),
        followedOrgs(userId),
      ]);
      const [mine, fromOrgs] = await Promise.all([
        eventsForIds(userId, [...new Set([...going, ...saved])]),
        orgEvents(
          userId,
          orgs.map((o) => o.id),
        ),
      ]);
      return {
        name: "The Forum",
        description: "Going, saved, and events from organizations you follow on The Forum",
        events: dedupeSorted([...mine, ...fromOrgs]),
      };
    }
  }
}

export function feedToIcs(feed: { name: string; description: string; events: FeedEventRow[] }) {
  const site = SITE_URL;
  const icsEvents: IcsEvent[] = feed.events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.datetime,
    end: e.endDatetime,
    location: e.locationName,
    locationDetail: e.locationDetail,
    description: e.orgName ? `Hosted by ${e.orgName}\n\n${e.description}` : e.description,
    url: `${site}/events/${e.id}`,
    updatedAt: e.updatedAt,
  }));
  return buildIcsCalendar({ name: feed.name, description: feed.description, events: icsEvents });
}
