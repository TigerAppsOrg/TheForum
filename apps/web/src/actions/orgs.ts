"use server";

import {
  events,
  and,
  campusLocations,
  db,
  desc,
  eq,
  eventTags,
  ilike,
  inArray,
  or,
  orgFollowers,
  orgMembers,
  organizations,
  sql,
  userInterests,
  users,
} from "@the-forum/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "~/auth";
import { formatEventDateTime } from "~/lib/date-format";
import { eventVisibleTo } from "~/lib/event-visibility";
import { enforceRateLimit } from "~/lib/rate-limit";
import { uploadedImageUrlSchema } from "~/lib/s3";
import { containsPattern } from "~/lib/sql-helpers";
import { idSchema, orgCategorySchema, parseInput } from "~/lib/validation";

export interface OrgListItem {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  category: string;
  followerCount: number;
  isFollowing: boolean;
}

export interface OrgDetail {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  category: string;
  creatorId: string;
  followerCount: number;
  isFollowing: boolean;
  isOwner: boolean;
  members: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    datetime: string;
    locationName: string;
    flyerUrl: string | null;
    tags: string[];
    /** Only owners/officers (and creators) ever receive drafts or private events here. */
    status: "draft" | "published";
    isPublic: boolean;
  }[];
}

const getOrgsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.union([orgCategorySchema, z.literal("")]).optional(),
});

export async function getOrgs(params?: {
  search?: string;
  category?: string;
}): Promise<OrgListItem[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const input = parseInput(getOrgsSchema, params ?? {});
  const conditions = [];

  if (input.search) {
    const pattern = containsPattern(input.search);
    conditions.push(
      or(ilike(organizations.name, pattern), ilike(organizations.description, pattern)),
    );
  }

  if (input.category) {
    conditions.push(eq(organizations.category, input.category));
  }

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      description: organizations.description,
      logoUrl: organizations.logoUrl,
      category: organizations.category,
    })
    .from(organizations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(organizations.name);

  if (orgs.length === 0) return [];

  // Follower counts + the viewer's follow state: two grouped queries for the
  // whole list, instead of two queries per org.
  const orgIds = orgs.map((o) => o.id);
  const [countRows, myFollows] = await Promise.all([
    db
      .select({ orgId: orgFollowers.orgId, count: sql<number>`count(*)::int` })
      .from(orgFollowers)
      .where(inArray(orgFollowers.orgId, orgIds))
      .groupBy(orgFollowers.orgId),
    db
      .select({ orgId: orgFollowers.orgId })
      .from(orgFollowers)
      .where(and(eq(orgFollowers.userId, userId), inArray(orgFollowers.orgId, orgIds))),
  ]);
  const countByOrg = new Map(countRows.map((r) => [r.orgId, r.count]));
  const followed = new Set(myFollows.map((r) => r.orgId));

  return orgs.map((org) => ({
    ...org,
    followerCount: countByOrg.get(org.id) ?? 0,
    isFollowing: followed.has(org.id),
  }));
}

export async function getOrg(orgId: string): Promise<OrgDetail | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Not a well-formed id → not found (rather than a Postgres cast error).
  if (!idSchema.safeParse(orgId).success) return null;

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

  if (!org) return null;

  // Follower count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgFollowers)
    .where(eq(orgFollowers.orgId, orgId));

  // Is following
  const [following] = await db
    .select()
    .from(orgFollowers)
    .where(and(eq(orgFollowers.orgId, orgId), eq(orgFollowers.userId, userId)))
    .limit(1);

  // Members
  const members = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));

  // Upcoming events
  const upcomingEventsRaw = await db
    .select({
      id: events.id,
      title: events.title,
      datetime: events.datetime,
      locationName: campusLocations.name,
      flyerUrl: events.flyerUrl,
      status: events.status,
      isPublic: events.isPublic,
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .where(
      and(
        eq(events.orgId, orgId),
        sql`${events.datetime} > now()`,
        // Drafts/private events only for the org's owners/officers (and creators).
        eventVisibleTo(userId),
      ),
    )
    .orderBy(events.datetime)
    .limit(10);

  // One query for every event's tags rather than one per event.
  const tagRows =
    upcomingEventsRaw.length === 0
      ? []
      : await db
          .select({ eventId: eventTags.eventId, tag: eventTags.tag })
          .from(eventTags)
          .where(
            inArray(
              eventTags.eventId,
              upcomingEventsRaw.map((e) => e.id),
            ),
          );
  const tagsByEvent = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByEvent.get(row.eventId);
    if (list) list.push(row.tag);
    else tagsByEvent.set(row.eventId, [row.tag]);
  }

  const upcomingEvents = upcomingEventsRaw.map((e) => ({
    id: e.id,
    title: e.title,
    datetime: formatEventDateTime(e.datetime),
    locationName: e.locationName ?? "TBD",
    flyerUrl: e.flyerUrl,
    tags: tagsByEvent.get(e.id) ?? [],
    status: e.status,
    isPublic: e.isPublic,
  }));

  return {
    id: org.id,
    name: org.name,
    description: org.description,
    logoUrl: org.logoUrl,
    category: org.category,
    creatorId: org.creatorId,
    followerCount: countResult?.count ?? 0,
    isFollowing: !!following,
    isOwner: org.creatorId === userId,
    members,
    upcomingEvents,
  };
}

const createOrgSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(120),
  description: z.string().trim().max(5_000),
  category: orgCategorySchema,
  logoUrl: uploadedImageUrlSchema("org-logos"),
});

export async function createOrg(data: {
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
}): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const input = parseInput(createOrgSchema, data);
  enforceRateLimit("createOrg", userId);

  // Verify user is an org leader
  const [user] = await db
    .select({ isOrgLeader: users.isOrgLeader })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.isOrgLeader) {
    throw new Error("Only org leaders can create organizations");
  }

  // Org + owner membership commit together; a name clash (unique) is reported
  // as a readable error rather than a raw constraint violation.
  const orgId = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: input.name,
        description: input.description,
        category: input.category,
        logoUrl: input.logoUrl,
        creatorId: userId,
      })
      .onConflictDoNothing({ target: organizations.name })
      .returning({ id: organizations.id });

    if (!org) throw new Error("An organization with that name already exists");

    await tx.insert(orgMembers).values({ orgId: org.id, userId, role: "owner" });
    return org.id;
  });

  revalidatePath("/orgs");
  return { id: orgId };
}

export async function toggleFollowOrg(orgId: string): Promise<{ following: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const id = parseInput(idSchema, orgId);

  const [existing] = await db
    .select({ orgId: orgFollowers.orgId })
    .from(orgFollowers)
    .where(and(eq(orgFollowers.orgId, id), eq(orgFollowers.userId, userId)))
    .limit(1);

  // Idempotent either way, so a double-click can't throw on the primary key.
  if (existing) {
    await db
      .delete(orgFollowers)
      .where(and(eq(orgFollowers.orgId, id), eq(orgFollowers.userId, userId)));
  } else {
    await db.insert(orgFollowers).values({ orgId: id, userId }).onConflictDoNothing();
  }

  revalidatePath(`/orgs/${id}`);
  revalidatePath("/orgs");

  return { following: !existing };
}

const officerSchema = z.object({ orgId: idSchema, userId: idSchema });

async function assertOrgCreator(orgId: string, callerId: string, message: string) {
  const [org] = await db
    .select({ creatorId: organizations.creatorId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org || org.creatorId !== callerId) throw new Error(message);
}

/** Idempotent: adding an existing officer is a no-op; a plain member is promoted. */
export async function addOfficer(orgId: string, userId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const input = parseInput(officerSchema, { orgId, userId });
  await assertOrgCreator(input.orgId, session.user.id, "Only the org owner can add officers");

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!target) throw new Error("User not found");

  await db
    .insert(orgMembers)
    .values({ orgId: input.orgId, userId: input.userId, role: "officer" })
    .onConflictDoNothing();
  await db
    .update(orgMembers)
    .set({ role: "officer" })
    .where(
      and(
        eq(orgMembers.orgId, input.orgId),
        eq(orgMembers.userId, input.userId),
        eq(orgMembers.role, "member"),
      ),
    );

  revalidatePath(`/orgs/${input.orgId}`);
}

export async function removeOfficer(orgId: string, userId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const input = parseInput(officerSchema, { orgId, userId });
  await assertOrgCreator(input.orgId, session.user.id, "Only the org owner can remove officers");

  // Officers only — never the owner row, so an org can't be left ownerless.
  await db
    .delete(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, input.orgId),
        eq(orgMembers.userId, input.userId),
        eq(orgMembers.role, "officer"),
      ),
    );

  revalidatePath(`/orgs/${input.orgId}`);
}

export async function getUserOrgs(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const memberships = await db
    .select({ orgId: orgMembers.orgId, name: organizations.name })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(
      and(eq(orgMembers.userId, session.user.id), inArray(orgMembers.role, ["owner", "officer"])),
    )
    .orderBy(organizations.name);

  return memberships.map((m) => ({ id: m.orgId, name: m.name }));
}

export async function getRecommendedOrgs(): Promise<OrgListItem[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Get user's interest tags
  const interests = await db
    .select({ tag: userInterests.tag })
    .from(userInterests)
    .where(eq(userInterests.userId, userId));

  if (interests.length === 0) return [];

  const interestTags = interests.map((i) => i.tag);

  // Get orgs the user already follows
  const followedOrgs = await db
    .select({ orgId: orgFollowers.orgId })
    .from(orgFollowers)
    .where(eq(orgFollowers.userId, userId));

  const followedOrgIds = followedOrgs.map((f) => f.orgId);

  // Find orgs whose events have matching tags, ranked by overlap count
  const recommended = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      description: organizations.description,
      logoUrl: organizations.logoUrl,
      category: organizations.category,
      overlapCount: sql<number>`count(distinct ${eventTags.tag})::int`.as("overlap_count"),
    })
    .from(organizations)
    .innerJoin(events, eq(events.orgId, organizations.id))
    .innerJoin(eventTags, eq(eventTags.eventId, events.id))
    .where(
      and(
        inArray(eventTags.tag, interestTags),
        // Only publicly listed events count as evidence of what an org hosts.
        eq(events.status, "published"),
        eq(events.isPublic, true),
        followedOrgIds.length > 0
          ? sql`${organizations.id} NOT IN (${sql.join(
              followedOrgIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : undefined,
      ),
    )
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.description,
      organizations.logoUrl,
      organizations.category,
    )
    .orderBy(desc(sql`overlap_count`))
    .limit(6);

  return recommended.map((org) => ({
    id: org.id,
    name: org.name,
    description: org.description,
    logoUrl: org.logoUrl,
    category: org.category,
    followerCount: 0,
    isFollowing: false,
  }));
}
