"use server";

import { headers } from "next/headers";
import { auth } from "~/auth";
import {
  type FeedEventRow,
  ensureCalendarToken,
  eventsForIds,
  followedOrgs,
  orgEvents,
  rotateCalendarToken,
  rsvpedEventIds,
  savedEventIds,
} from "~/lib/calendar-feeds";
import { getAppOrigin } from "~/lib/cas-server";

export type CalendarId = "going" | "saved" | `org-${string}`;

export interface CalendarInfo {
  id: CalendarId;
  name: string;
  kind: "going" | "saved" | "org";
  orgId?: string;
  logoUrl?: string | null;
  /** Org calendars: true if followed; false = suggested from your RSVPs/saves. */
  followed?: boolean;
  /** Secret feed URL (https) for subscribing/downloading. */
  feedUrl: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  location: string | null;
  locationDetail: string | null;
  orgName: string | null;
  /** Every calendar this event belongs to (an RSVP'd event from a followed org is in both). */
  calendars: CalendarId[];
}

export interface MyCalendars {
  calendars: CalendarInfo[];
  /** Combined "All my Forum events" feed. */
  allFeedUrl: string;
  events: CalendarEvent[];
}

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

async function feedBase(token: string) {
  const origin = getAppOrigin(await headers());
  return `${origin}/cal/${token}`;
}

/**
 * Everything the My Events calendar needs: the user's calendars (with secret
 * feed URLs — the token is created on first use) and the events in them from
 * two months back onwards.
 */
export async function getMyCalendars(): Promise<MyCalendars> {
  const userId = await requireUserId();
  const token = await ensureCalendarToken(userId);
  const base = await feedBase(token);

  const [goingIds, savedIds, followed] = await Promise.all([
    rsvpedEventIds(userId),
    savedEventIds(userId),
    followedOrgs(userId),
  ]);
  const mine = await eventsForIds(userId, [...new Set([...goingIds, ...savedIds])]);

  // Orgs behind your RSVPs/saves that you don't follow are offered too.
  const followedIds = new Set(followed.map((o) => o.id));
  const suggested = new Map<string, string>();
  for (const e of mine) {
    if (e.orgId && e.orgName && !followedIds.has(e.orgId)) suggested.set(e.orgId, e.orgName);
  }
  const orgIds = [...followedIds, ...suggested.keys()];
  const fromOrgs = await orgEvents(userId, orgIds);

  const going = new Set(goingIds);
  const saved = new Set(savedIds);
  const byId = new Map<string, { row: FeedEventRow; calendars: Set<CalendarId> }>();
  const add = (row: FeedEventRow, cal: CalendarId) => {
    const entry = byId.get(row.id) ?? { row, calendars: new Set<CalendarId>() };
    entry.calendars.add(cal);
    byId.set(row.id, entry);
  };
  for (const row of mine) {
    if (going.has(row.id)) add(row, "going");
    if (saved.has(row.id)) add(row, "saved");
  }
  for (const row of fromOrgs) if (row.orgId) add(row, `org-${row.orgId}`);

  const calendars: CalendarInfo[] = [
    { id: "going", name: "Going", kind: "going", feedUrl: `${base}/going.ics` },
    { id: "saved", name: "Saved", kind: "saved", feedUrl: `${base}/saved.ics` },
    ...followed.map(
      (o): CalendarInfo => ({
        id: `org-${o.id}`,
        name: o.name,
        kind: "org",
        orgId: o.id,
        logoUrl: o.logoUrl,
        followed: true,
        feedUrl: `${base}/org-${o.id}.ics`,
      }),
    ),
    ...[...suggested.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(
        ([id, name]): CalendarInfo => ({
          id: `org-${id}`,
          name,
          kind: "org",
          orgId: id,
          followed: false,
          feedUrl: `${base}/org-${id}.ics`,
        }),
      ),
  ];

  const events: CalendarEvent[] = [...byId.values()]
    .sort((a, b) => a.row.datetime.getTime() - b.row.datetime.getTime())
    .map(({ row, calendars: cals }) => ({
      id: row.id,
      title: row.title,
      start: row.datetime.toISOString(),
      end: row.endDatetime?.toISOString() ?? null,
      location: row.locationName,
      locationDetail: row.locationDetail,
      orgName: row.orgName,
      calendars: [...cals],
    }));

  return { calendars, allFeedUrl: `${base}/all.ics`, events };
}

/** Rotate the secret: every previously shared feed URL stops working. */
export async function resetCalendarLink(): Promise<void> {
  const userId = await requireUserId();
  await rotateCalendarToken(userId);
}
