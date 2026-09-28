import { type NextRequest, NextResponse } from "next/server";
import { buildLogoutUrl } from "~/lib/cas";
import { casBaseUrl, getAppOrigin } from "~/lib/cas-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/cas/logout
 *
 * Final hop of sign-out: the client first calls Auth.js `signOut()` (which
 * clears our session cookie via a CSRF-protected POST) with this route as the
 * redirect target, and we then end the Princeton CAS SSO session too, so the
 * next person on a shared computer isn't silently signed back in.
 *
 * This route itself changes no state on our side.
 */
export function GET(req: NextRequest) {
  const origin = getAppOrigin(req.headers, req.nextUrl.protocol);
  const res = NextResponse.redirect(buildLogoutUrl(casBaseUrl, `${origin}/`), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
