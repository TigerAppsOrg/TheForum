import { events, and, db, eq, inArray, or, orgMembers } from "@the-forum/database";

/**
 * Event visibility — the ONE place this rule is defined. Server-only.
 *
 * A viewer may see an event if
 *   (status = 'published' AND is_public)
 *   OR the viewer created it
 *   OR the viewer is an owner/officer of the event's org.
 *
 * Every query that returns events the viewer did not create must include
 * `eventVisibleTo(viewerId)` (or `eventDiscoverableBy`, below) in its WHERE.
 */

const MANAGER_ROLES = ["owner", "officer"] as const;

/** Subquery: ids of orgs the viewer can manage (owner/officer). */
export function managedOrgIdsQuery(viewerId: string) {
  return db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, viewerId), inArray(orgMembers.role, [...MANAGER_ROLES])));
}

/** WHERE fragment: the event is visible to `viewerId` (drafts/private included for their managers). */
export function eventVisibleTo(viewerId: string) {
  const visible = or(
    and(eq(events.status, "published"), eq(events.isPublic, true)),
    eq(events.creatorId, viewerId),
    inArray(events.orgId, managedOrgIdsQuery(viewerId)),
  );
  // `or` only returns undefined when given no arguments.
  if (!visible) throw new Error("unreachable: empty visibility predicate");
  return visible;
}

/**
 * WHERE fragment for discovery surfaces (Explore, map, similar events,
 * friends' activity): published AND visible. Drafts never appear in discovery,
 * even to their authors — they live in My Events and on the org page.
 * Private published events still show for their creator and org managers.
 */
export function eventDiscoverableBy(viewerId: string) {
  const discoverable = and(eq(events.status, "published"), eventVisibleTo(viewerId));
  if (!discoverable) throw new Error("unreachable: empty visibility predicate");
  return discoverable;
}

/** WHERE fragment: the viewer may edit the event (creator, or owner/officer of its org). */
export function eventEditableBy(viewerId: string) {
  const editable = or(
    eq(events.creatorId, viewerId),
    inArray(events.orgId, managedOrgIdsQuery(viewerId)),
  );
  if (!editable) throw new Error("unreachable: empty edit predicate");
  return editable;
}

/** True if `eventId` exists and `viewerId` may edit it. */
export async function canEditEvent(eventId: string, viewerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eventEditableBy(viewerId)))
    .limit(1);
  return !!row;
}

/** True if `eventId` exists and is visible to `viewerId`. */
export async function canViewEvent(eventId: string, viewerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eventVisibleTo(viewerId)))
    .limit(1);
  return !!row;
}
