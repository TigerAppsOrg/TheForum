import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  CAS_COOKIE_MAX_AGE_SECONDS,
  CAS_COOKIE_PATH,
  CAS_RETURN_COOKIE,
  CAS_STATE_COOKIE,
  buildLoginUrl,
  buildServiceUrl,
  generateState,
  sanitizeReturnPath,
} from "~/lib/cas";
import { casBaseUrl, getAppOrigin } from "~/lib/cas-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/cas/login?callbackUrl=/some/path
 *
 * Starts a Princeton CAS login: stores a random `state` (anti login-CSRF) and a
 * sanitized local return path in short-lived httpOnly cookies, then redirects
 * to CAS with `service` pointing at our callback.
 */
export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req.headers, req.nextUrl.protocol);
  const state = generateState();
  const returnPath = sanitizeReturnPath(req.nextUrl.searchParams.get("callbackUrl"));
  const service = buildServiceUrl(origin, state);

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: origin.startsWith("https:"),
    path: CAS_COOKIE_PATH,
    maxAge: CAS_COOKIE_MAX_AGE_SECONDS,
  };
  const jar = await cookies();
  jar.set(CAS_STATE_COOKIE, state, cookieOptions);
  jar.set(CAS_RETURN_COOKIE, returnPath, cookieOptions);

  const res = NextResponse.redirect(buildLoginUrl(casBaseUrl, service), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
