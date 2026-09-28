"use server";

import { and, db, eq, friendships, ilike, ne, notifications, or, users } from "@the-forum/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "~/auth";
import { enforceRateLimit } from "~/lib/rate-limit";
import { containsPattern } from "~/lib/sql-helpers";
import { idSchema, parseInput } from "~/lib/validation";

export interface FriendProfile {
  id: string;
  displayName: string;
  netId: string;
  avatarUrl: string | null;
  classYear: string | null;
  major: string | null;
}

/** Just what the search results UI renders — nothing more leaves the server. */
export type UserSearchResult = Pick<
  FriendProfile,
  "id" | "displayName" | "netId" | "avatarUrl" | "classYear"
>;

export interface FriendRequest {
  id: string;
  displayName: string;
  netId: string;
  avatarUrl: string | null;
  createdAt: Date;
}

const SEARCH_MIN_LENGTH = 2;
const SEARCH_MAX_RESULTS = 20;
const searchQuerySchema = z.string().max(200);

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const q = parseInput(searchQuerySchema, query).trim().slice(0, 100);
  // Too short to be selective — would page through the whole user table.
  if (q.length < SEARCH_MIN_LENGTH) return [];

  enforceRateLimit("searchUsers", session.user.id);

  const pattern = containsPattern(q);
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      netId: users.netId,
      avatarUrl: users.avatarUrl,
      classYear: users.classYear,
    })
    .from(users)
    .where(
      and(
        or(ilike(users.displayName, pattern), ilike(users.netId, pattern)),
        ne(users.id, session.user.id),
      ),
    )
    .orderBy(users.displayName)
    .limit(SEARCH_MAX_RESULTS);
}

export async function getFriends(): Promise<FriendProfile[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Friends where current user is the sender
  const sent = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      netId: users.netId,
      avatarUrl: users.avatarUrl,
      classYear: users.classYear,
      major: users.major,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.friendId, users.id))
    .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted")));

  // Friends where current user is the receiver
  const received = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      netId: users.netId,
      avatarUrl: users.avatarUrl,
      classYear: users.classYear,
      major: users.major,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.userId, users.id))
    .where(and(eq(friendships.friendId, userId), eq(friendships.status, "accepted")));

  return [...sent, ...received];
}

export async function getPendingRequests(): Promise<{
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const incoming = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      netId: users.netId,
      avatarUrl: users.avatarUrl,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.userId, users.id))
    .where(and(eq(friendships.friendId, userId), eq(friendships.status, "pending")));

  const outgoing = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      netId: users.netId,
      avatarUrl: users.avatarUrl,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.friendId, users.id))
    .where(and(eq(friendships.userId, userId), eq(friendships.status, "pending")));

  return { incoming, outgoing };
}

export async function getFriendshipStatus(
  otherUserId: string,
): Promise<"none" | "pending_sent" | "pending_received" | "accepted"> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const otherId = parseInput(idSchema, otherUserId);

  const [sent] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, otherId)))
    .limit(1);

  if (sent) {
    return sent.status === "accepted" ? "accepted" : "pending_sent";
  }

  const [received] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.userId, otherId), eq(friendships.friendId, userId)))
    .limit(1);

  if (received) {
    return received.status === "accepted" ? "accepted" : "pending_received";
  }

  return "none";
}

/**
 * Idempotent: repeating a request (double-click, retry) is a no-op, and
 * requesting someone who already requested you accepts theirs.
 */
export async function sendFriendRequest(friendId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const targetId = parseInput(idSchema, friendId);
  if (userId === targetId) throw new Error("Cannot send friend request to yourself");

  // Check if friendship already exists in either direction
  const [existing] = await db
    .select({ userId: friendships.userId, status: friendships.status })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, targetId)),
        and(eq(friendships.userId, targetId), eq(friendships.friendId, userId)),
      ),
    )
    .limit(1);

  if (existing) {
    // They already asked us: treat this as accepting.
    if (existing.userId === targetId && existing.status === "pending") {
      await db
        .update(friendships)
        .set({ status: "accepted" })
        .where(
          and(
            eq(friendships.userId, targetId),
            eq(friendships.friendId, userId),
            eq(friendships.status, "pending"),
          ),
        );
      revalidatePath("/friends");
    }
    return;
  }

  enforceRateLimit("friendRequest", userId);

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target) throw new Error("User not found");

  // A concurrent duplicate hits the primary key and inserts nothing — and then
  // sends no second notification.
  const inserted = await db
    .insert(friendships)
    .values({ userId, friendId: targetId, status: "pending" })
    .onConflictDoNothing()
    .returning({ userId: friendships.userId });

  if (inserted.length > 0) {
    await db.insert(notifications).values({
      userId: targetId,
      type: "friend_request",
      payload: {
        fromUserId: userId,
        fromDisplayName: session.user.name ?? "Someone",
      },
    });
  }

  revalidatePath("/friends");
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const fromId = parseInput(idSchema, fromUserId);

  await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(
      and(
        eq(friendships.userId, fromId),
        eq(friendships.friendId, session.user.id),
        eq(friendships.status, "pending"),
      ),
    );

  revalidatePath("/friends");
}

export async function declineFriendRequest(fromUserId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const fromId = parseInput(idSchema, fromUserId);

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.userId, fromId),
        eq(friendships.friendId, session.user.id),
        eq(friendships.status, "pending"),
      ),
    );

  revalidatePath("/friends");
}

export async function removeFriend(friendId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const otherId = parseInput(idSchema, friendId);

  await db
    .delete(friendships)
    .where(
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, otherId)),
        and(eq(friendships.userId, otherId), eq(friendships.friendId, userId)),
      ),
    );

  revalidatePath("/friends");
}
