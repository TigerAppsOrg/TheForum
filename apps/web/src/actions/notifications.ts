"use server";

import {
  events,
  and,
  db,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lt,
  notifications,
  or,
  rsvps,
  sql,
} from "@the-forum/database";
import { auth } from "~/auth";
import { eventVisibleTo } from "~/lib/event-visibility";

export interface NotificationItem {
  id: string;
  type: "friend_request" | "event_reminder" | "org_new_event";
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

/**
 * WHERE fragment: the notification either references no event, or references
 * an event the viewer can still see. An org_new_event notification for an
 * event that was later unpublished, made private or deleted is hidden rather
 * than leaking its title.
 */
function referencedEventStillVisible(userId: string) {
  return or(
    sql`${notifications.payload}->>'eventId' IS NULL`,
    exists(
      db
        .select({ one: sql`1` })
        .from(events)
        .where(
          and(
            sql`${events.id}::text = ${notifications.payload}->>'eventId'`,
            eventVisibleTo(userId),
          ),
        ),
    ),
  );
}

export async function getNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // On-demand: generate event reminders for RSVP'd, still-visible events in the next 24h.
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingRsvps = await db
    .select({ eventId: events.id, title: events.title })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .where(
      and(
        eq(rsvps.userId, userId),
        gte(events.datetime, now),
        lt(events.datetime, in24h),
        eventVisibleTo(userId),
      ),
    );

  if (upcomingRsvps.length > 0) {
    // One lookup for every existing reminder instead of one per event.
    const existing = await db
      .select({ eventId: sql<string>`${notifications.payload}->>'eventId'` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "event_reminder"),
          inArray(
            sql`${notifications.payload}->>'eventId'`,
            upcomingRsvps.map((r) => r.eventId),
          ),
        ),
      );
    const alreadyReminded = new Set(existing.map((r) => r.eventId));
    const missing = upcomingRsvps.filter((r) => !alreadyReminded.has(r.eventId));

    if (missing.length > 0) {
      await db.insert(notifications).values(
        missing.map((r) => ({
          userId,
          type: "event_reminder" as const,
          payload: { eventId: r.eventId, eventTitle: r.title },
        })),
      );
    }
  }

  const visibleToMe = and(eq(notifications.userId, userId), referencedEventStillVisible(userId));

  const [items, [countResult]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(visibleToMe)
      .orderBy(desc(notifications.createdAt))
      .limit(20),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(visibleToMe, eq(notifications.read, false))),
  ]);

  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload as Record<string, unknown>,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: countResult?.count ?? 0,
  };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, session.user.id)));
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));
}
