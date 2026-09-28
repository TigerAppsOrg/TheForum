"use server";

import { auth } from "~/auth";
import { type InboxMessageDetail, getEmailById } from "~/lib/inbox-engine";
import { checkRateLimit } from "~/lib/rate-limit";

/**
 * Loads one full email for the org-page reader. Signed-in users only
 * (rate-limited); returns null — never throws — when the email can't be
 * fetched, so the reader can show a friendly fallback.
 */
export async function getInboxEmail(id: string): Promise<InboxMessageDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (typeof id !== "string") return null;
  if (!checkRateLimit("readEmail", session.user.id).ok) return null;
  return getEmailById(id);
}
