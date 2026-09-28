import { and, db, eq, orgBlocks, orgFollowers } from "@the-forum/database";

/**
 * Per-viewer org preferences: follow (hoist in the feed) and hide (remove from
 * discovery). Server-only; the server actions in `~/actions/orgs.ts` wrap these
 * with auth, validation and rate limiting.
 *
 * The two are mutually exclusive — hiding an org unfollows it and following
 * one unhides it — and each write happens in one transaction so the pair can
 * never end up both set. Every write is idempotent.
 */

export interface OrgViewerState {
  following: boolean;
  hidden: boolean;
}

export async function loadOrgViewerState(userId: string, orgId: string): Promise<OrgViewerState> {
  const [[follow], [block]] = await Promise.all([
    db
      .select({ orgId: orgFollowers.orgId })
      .from(orgFollowers)
      .where(and(eq(orgFollowers.userId, userId), eq(orgFollowers.orgId, orgId)))
      .limit(1),
    db
      .select({ orgId: orgBlocks.orgId })
      .from(orgBlocks)
      .where(and(eq(orgBlocks.userId, userId), eq(orgBlocks.orgId, orgId)))
      .limit(1),
  ]);
  return { following: !!follow, hidden: !!block };
}

/** Follow `orgId`, clearing any hide. */
export async function setFollowing(userId: string, orgId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(orgBlocks).where(and(eq(orgBlocks.userId, userId), eq(orgBlocks.orgId, orgId)));
    await tx.insert(orgFollowers).values({ userId, orgId }).onConflictDoNothing();
  });
}

export async function clearFollowing(userId: string, orgId: string): Promise<void> {
  await db
    .delete(orgFollowers)
    .where(and(eq(orgFollowers.userId, userId), eq(orgFollowers.orgId, orgId)));
}

/** Hide `orgId`, unfollowing it. Returns whether a follow was removed (so Undo can restore it). */
export async function setHidden(userId: string, orgId: string): Promise<{ unfollowed: boolean }> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(orgFollowers)
      .where(and(eq(orgFollowers.userId, userId), eq(orgFollowers.orgId, orgId)))
      .returning({ orgId: orgFollowers.orgId });
    await tx.insert(orgBlocks).values({ userId, orgId }).onConflictDoNothing();
    return { unfollowed: removed.length > 0 };
  });
}

export async function clearHidden(userId: string, orgId: string): Promise<void> {
  await db.delete(orgBlocks).where(and(eq(orgBlocks.userId, userId), eq(orgBlocks.orgId, orgId)));
}
