import { and, db, eq, friendships } from "@the-forum/database";

/**
 * Accepted friend ids for a user. Friendships are stored one-directional
 * (requester → recipient), so both columns are read.
 *
 * Server-only: imported by server actions and `~/lib/feed.ts`.
 */
export async function loadFriendIds(userId: string): Promise<string[]> {
  const [outgoing, incoming] = await Promise.all([
    db
      .select({ friendId: friendships.friendId })
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted"))),
    db
      .select({ friendId: friendships.userId })
      .from(friendships)
      .where(and(eq(friendships.friendId, userId), eq(friendships.status, "accepted"))),
  ]);
  return [...new Set([...outgoing, ...incoming].map((r) => r.friendId))];
}
