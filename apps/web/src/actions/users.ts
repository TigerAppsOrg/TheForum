"use server";

import { db, eq, userInterests, userRegions, users } from "@the-forum/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "~/auth";
import { greetingName } from "~/lib/greeting-name";
import { uploadedImageUrlSchema } from "~/lib/s3";
import { campusRegionSchema, eventTagSchema, parseInput, uniqueEnumArray } from "~/lib/validation";

// Enum arrays are validated against the pgEnum values (never cast), and
// de-duplicated so a repeated value can't trip the composite primary key.
const profileFieldsSchema = z.object({
  classYear: z.string().trim().max(10),
  major: z.string().trim().max(255),
  isOrgLeader: z.boolean(),
  interests: uniqueEnumArray(eventTagSchema),
  regions: uniqueEnumArray(campusRegionSchema),
  // Optional everywhere: omitted means "leave the stored name alone".
  displayName: z.string().trim().min(1).max(255).optional(),
});

const onboardingSchema = profileFieldsSchema;
const updateProfileSchema = profileFieldsSchema.partial();

type InterestTag = z.output<typeof eventTagSchema>;
type CampusRegion = z.output<typeof campusRegionSchema>;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replaceInterests(tx: Tx, userId: string, interests: InterestTag[]) {
  await tx.delete(userInterests).where(eq(userInterests.userId, userId));
  if (interests.length > 0) {
    await tx
      .insert(userInterests)
      .values(interests.map((tag) => ({ userId, tag })))
      .onConflictDoNothing();
  }
}

async function replaceRegions(tx: Tx, userId: string, regions: CampusRegion[]) {
  await tx.delete(userRegions).where(eq(userRegions.userId, userId));
  if (regions.length > 0) {
    await tx
      .insert(userRegions)
      .values(regions.map((region) => ({ userId, region })))
      .onConflictDoNothing();
  }
}

export async function completeOnboarding(data: {
  interests: string[];
  classYear: string;
  major: string;
  regions: string[];
  isOrgLeader: boolean;
  displayName?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const input = parseInput(onboardingSchema, data);

  // One transaction, so a double-submit can't interleave two delete+insert
  // sequences and a failure can't leave a half-onboarded profile.
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        displayName: input.displayName,
        classYear: input.classYear,
        major: input.major,
        isOrgLeader: input.isOrgLeader,
        onboarded: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (input.interests.length > 0) await replaceInterests(tx, userId, input.interests);
    if (input.regions.length > 0) await replaceRegions(tx, userId, input.regions);
  });

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

/**
 * The name Home greets the viewer by (see ~/lib/greeting-name), read from the
 * database: the session's name is captured at sign-in, so it still holds the
 * NetID after onboarding sets a real display name.
 */
export async function getGreetingName(): Promise<string | null> {
  const user = await getCurrentUser();
  return greetingName(user.displayName, user.netId);
}

export async function getUserProfile(): Promise<UserProfile> {
  const user = await getCurrentUser();

  const interests = await db
    .select({ tag: userInterests.tag })
    .from(userInterests)
    .where(eq(userInterests.userId, user.id));

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
    interests: interests.map((i) => i.tag),
    regions: regions.map((r) => r.region),
  };
}

export async function updateProfile(data: {
  classYear?: string;
  major?: string;
  isOrgLeader?: boolean;
  interests?: string[];
  regions?: string[];
  displayName?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  const userId = user.id;
  const input = parseInput(updateProfileSchema, data);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        displayName: input.displayName,
        classYear: input.classYear,
        major: input.major,
        isOrgLeader: input.isOrgLeader,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (input.interests) await replaceInterests(tx, userId, input.interests);
    if (input.regions) await replaceRegions(tx, userId, input.regions);
  });

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/explore");
}

const avatarUrlSchema = uploadedImageUrlSchema("avatars");

export async function updateAvatar(avatarUrl: string): Promise<void> {
  const user = await getCurrentUser();
  // Must be one of our uploads (or empty to clear it).
  const url = parseInput(avatarUrlSchema, avatarUrl);

  await db
    .update(users)
    .set({ avatarUrl: url, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/explore");
}
