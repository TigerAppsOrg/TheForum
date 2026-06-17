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
import { auth } from "~/auth";
import { formatEventDateTime } from "~/lib/date-format";

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
  }[];
}

type OrgCategoryValue = typeof organizations.$inferSelect.category;

export async function getOrgs(params?: {
  search?: string;
  category?: string;
}): Promise<OrgListItem[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const conditions = [];

  if (params?.search) {
    conditions.push(
      or(
        ilike(organizations.name, `%${params.search}%`),
        ilike(organizations.description, `%${params.search}%`),
      ),
    );
  }

  if (params?.category) {
    conditions.push(eq(organizations.category, params.category as OrgCategoryValue));
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

  // Enrich with follower counts + follow status
  return Promise.all(
    orgs.map(async (org) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orgFollowers)
        .where(eq(orgFollowers.orgId, org.id));

      const [following] = await db
        .select()
        .from(orgFollowers)
        .where(and(eq(orgFollowers.orgId, org.id), eq(orgFollowers.userId, userId)))
        .limit(1);

      return {
        ...org,
        followerCount: countResult?.count ?? 0,
        isFollowing: !!following,
      };
    }),
  );
}

export async function getOrg(orgId: string): Promise<OrgDetail | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

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
    })
    .from(events)
    .leftJoin(campusLocations, eq(events.locationId, campusLocations.id))
    .where(and(eq(events.orgId, orgId), sql`${events.datetime} > now()`))
    .orderBy(events.datetime)
    .limit(10);

  const upcomingEvents = await Promise.all(
    upcomingEventsRaw.map(async (e) => {
      const tags = await db
        .select({ tag: eventTags.tag })
        .from(eventTags)
        .where(eq(eventTags.eventId, e.id));
      return {
        id: e.id,
        title: e.title,
        datetime: formatEventDateTime(e.datetime),
        locationName: e.locationName ?? "TBD",
        flyerUrl: e.flyerUrl,
        tags: tags.map((t) => t.tag),
      };
    }),
  );

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

export async function createOrg(data: {
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
}): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify user is an org leader
  const [user] = await db
    .select({ isOrgLeader: users.isOrgLeader })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.isOrgLeader) {
    throw new Error("Only org leaders can create organizations");
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: data.name,
      description: data.description,
      category: data.category as OrgCategoryValue,
      logoUrl: data.logoUrl ?? null,
      creatorId: session.user.id,
    })
    .returning({ id: organizations.id });

  if (!org) throw new Error("Failed to create organization");

  // Add creator as owner member
  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: session.user.id,
    role: "owner",
  });

  revalidatePath("/orgs");
  return { id: org.id };
}

export async function toggleFollowOrg(orgId: string): Promise<{ following: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [existing] = await db
    .select()
    .from(orgFollowers)
    .where(and(eq(orgFollowers.orgId, orgId), eq(orgFollowers.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(orgFollowers)
      .where(and(eq(orgFollowers.orgId, orgId), eq(orgFollowers.userId, userId)));
  } else {
    await db.insert(orgFollowers).values({ orgId, userId });
  }

  revalidatePath(`/orgs/${orgId}`);
  revalidatePath("/orgs");

  return { following: !existing };
}

export async function addOfficer(orgId: string, userId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify caller is org owner
  const [org] = await db
    .select({ creatorId: organizations.creatorId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org || org.creatorId !== session.user.id) {
    throw new Error("Only the org owner can add officers");
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);

  if (existing) throw new Error("User is already a member");

  await db.insert(orgMembers).values({ orgId, userId, role: "officer" });
  revalidatePath(`/orgs/${orgId}`);
}

export async function removeOfficer(orgId: string, userId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify caller is org owner
  const [org] = await db
    .select({ creatorId: organizations.creatorId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org || org.creatorId !== session.user.id) {
    throw new Error("Only the org owner can remove officers");
  }

  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));

  revalidatePath(`/orgs/${orgId}`);
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
