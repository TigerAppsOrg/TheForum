"use server";

import {
  type campusRegionEnum,
  db,
  eq,
  type eventTagEnum,
  userInterests,
  userRegions,
  users,
} from "@the-forum/database";
import { revalidatePath } from "next/cache";
import { auth } from "~/auth";

const LEGACY_INTEREST_TAG_ALIASES: Record<string, string> = {
  career: "career-recruiting",
  academic: "research",
  academics: "academics",
  tech: "tech",
  political: "politics-policy",
  politics: "politics-policy",
  art: "visual-arts",
  visual: "visual-arts",
  performance: "performing-arts",
  performing: "performing-arts",
  cultural: "culture",
  culture: "culture",
  sports: "athletics",
  athletic: "athletics",
  religious: "religion",
  religion: "religion",
  outdoor: "outdoor-adventure",
  outdoors: "outdoor-adventure",
  wellness: "wellness-self-care",
  speaker: "speaker-event",
  social: "social-event",
  "free food": "free-food",
  "free-food": "free-food",
  "community service": "community-service",
  "community-service": "community-service",
  "politics policy": "politics-policy",
  "visual arts": "visual-arts",
  "performing arts": "performing-arts",
  "wellness self care": "wellness-self-care",
  "speaker event": "speaker-event",
  "social event": "social-event",
  stem: "stem",
};

type InterestTag = (typeof eventTagEnum.enumValues)[number];
type CampusRegion = (typeof campusRegionEnum.enumValues)[number];

function normalizeInterestTag(tag: string): string {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, "-");
  return LEGACY_INTEREST_TAG_ALIASES[normalized] ?? LEGACY_INTEREST_TAG_ALIASES[tag] ?? normalized;
}

function dedupeInterests(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeInterestTag(value)).filter(Boolean))];
}

export async function completeOnboarding(data: {
  interests: string[];
  classYear: string;
  major: string;
  regions: string[];
  isOrgLeader: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  await db
    .update(users)
    .set({
      classYear: data.classYear,
      major: data.major,
      isOrgLeader: data.isOrgLeader,
      onboarded: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (data.interests.length > 0) {
    const normalizedInterests = dedupeInterests(data.interests);
    await db.delete(userInterests).where(eq(userInterests.userId, userId));
    await db.insert(userInterests).values(
      normalizedInterests.map((tag) => ({
        userId,
        tag: tag as InterestTag,
      })),
    );
  }

  if (data.regions.length > 0) {
    await db.delete(userRegions).where(eq(userRegions.userId, userId));
    await db.insert(userRegions).values(
      data.regions.map((region) => ({
        userId,
        region: region as CampusRegion,
      })),
    );
  }

  revalidatePath("/");
}

export interface UserProfile {
  id: string;
  displayName: string;
  netId: string;
  email: string;
  classYear: string | null;
  major: string | null;
  avatarUrl: string | null;
  isOrgLeader: boolean;
  interests: string[];
  regions: string[];
}

async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [userById] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (userById) return userById;

  if (session.user.netId) {
    const [userByNetId] = await db
      .select()
      .from(users)
      .where(eq(users.netId, session.user.netId))
      .limit(1);
    if (userByNetId) return userByNetId;
  }

  if (session.user.email) {
    const [userByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
    if (userByEmail) return userByEmail;
  }

  const netId = session.user.netId ?? session.user.email?.split("@")[0]?.toLowerCase();
  if (!netId || !session.user.email) throw new Error("User not found");

  const [createdUser] = await db
    .insert(users)
    .values({
      id: session.user.id,
      netId,
      email: session.user.email,
      displayName: session.user.name ?? netId,
    })
    .returning();

  if (!createdUser) throw new Error("User not found");

  return createdUser;
}

export async function getUserProfile(): Promise<UserProfile> {
  const user = await getCurrentUser();

  const interests = await db
    .select({ tag: userInterests.tag })
    .from(userInterests)
    .where(eq(userInterests.userId, user.id));

  const normalizedInterests = dedupeInterests(interests.map(({ tag }) => tag));

  const regions = await db
    .select({ region: userRegions.region })
    .from(userRegions)
    .where(eq(userRegions.userId, user.id));

  return {
    id: user.id,
    displayName: user.displayName,
    netId: user.netId,
    email: user.email,
    classYear: user.classYear,
    major: user.major,
    avatarUrl: user.avatarUrl,
    isOrgLeader: user.isOrgLeader,
    interests: normalizedInterests,
    regions: regions.map((r) => r.region),
  };
}

export async function updateProfile(data: {
  classYear?: string;
  major?: string;
  isOrgLeader?: boolean;
  interests?: string[];
  regions?: string[];
}): Promise<void> {
  const user = await getCurrentUser();
  const userId = user.id;

  await db
    .update(users)
    .set({
      classYear: data.classYear,
      major: data.major,
      isOrgLeader: data.isOrgLeader,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (data.interests) {
    const normalizedInterests = dedupeInterests(data.interests);
    await db.delete(userInterests).where(eq(userInterests.userId, userId));
    if (normalizedInterests.length > 0) {
      await db.insert(userInterests).values(
        normalizedInterests.map((tag) => ({
          userId,
          tag: tag as InterestTag,
        })),
      );
    }
  }

  if (data.regions) {
    await db.delete(userRegions).where(eq(userRegions.userId, userId));
    if (data.regions.length > 0) {
      await db.insert(userRegions).values(
        data.regions.map((region) => ({
          userId,
          region: region as CampusRegion,
        })),
      );
    }
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/explore");
}

export async function updateAvatar(avatarUrl: string): Promise<void> {
  const user = await getCurrentUser();

  await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, user.id));

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/explore");
}
