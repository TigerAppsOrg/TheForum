import type { NextRequest } from "next/server";
import {
  feedSlug,
  feedToIcs,
  findUserIdByCalendarToken,
  loadFeed,
  parseFeedSlug,
} from "~/lib/calendar-feeds";

export const dynamic = "force-dynamic";

/**
 * GET /cal/<token>/<going|saved|all|org-<id>>.ics
 *
 * Public route (see proxy.ts) authorized purely by the secret token: it
 * resolves to one user and every query applies that user's visibility rules.
 * `?download=1` serves the same calendar as an attachment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; feed: string }> },
) {
  const { token, feed } = await params;
  const key = parseFeedSlug(feed);
  if (!key || !feed.toLowerCase().endsWith(".ics")) {
    return new Response("Not found", { status: 404 });
  }

  const userId = await findUserIdByCalendarToken(token);
  // Same response for a bad token as for a missing feed: nothing to probe.
  if (!userId) return new Response("Not found", { status: 404 });

  const data = await loadFeed(userId, key);
  if (!data) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "private, max-age=300",
    // Feed URLs carry a secret; keep them out of search indexes and referrers.
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  });
  if (req.nextUrl.searchParams.get("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="forum-${feedSlug(key)}.ics"`);
  }
  return new Response(feedToIcs(data), { status: 200, headers });
}
