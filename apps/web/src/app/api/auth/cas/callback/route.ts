import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { CAS_PROVIDER_ID, signIn } from "~/auth";
import {
  CAS_COOKIE_PATH,
  CAS_RETURN_COOKIE,
  CAS_STATE_COOKIE,
  buildServiceUrl,
  isValidState,
  isValidTicket,
  safeCompare,
  sanitizeReturnPath,
} from "~/lib/cas";
import { getAppOrigin } from "~/lib/cas-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/cas/callback?state=…&ticket=ST-…
 *
 * CAS redirects here after login. We verify `state` against the cookie set by
 * /api/auth/cas/login, then hand the ticket to the Auth.js CAS provider, whose
 * `authorize()` validates it with CAS (serviceValidate) and upserts the user.
 * On success `signIn()` sets the session cookie and throws a Next redirect to
 * the saved return path, which Next turns into the response.
 */
export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req.headers, req.nextUrl.protocol);
  const fail = (error: string) => {
    const url = new URL("/auth/error", origin);
    url.searchParams.set("error", error);
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  const jar = await cookies();
  const expectedState = jar.get(CAS_STATE_COOKIE)?.value;
  const returnPath = sanitizeReturnPath(jar.get(CAS_RETURN_COOKIE)?.value);
  // One-shot: the state/return cookies are consumed whatever happens next.
  jar.delete({ name: CAS_STATE_COOKIE, path: CAS_COOKIE_PATH });
  jar.delete({ name: CAS_RETURN_COOKIE, path: CAS_COOKIE_PATH });

  const state = req.nextUrl.searchParams.get("state");
  const ticket = req.nextUrl.searchParams.get("ticket");

  if (!expectedState || !isValidState(state) || !safeCompare(state, expectedState)) {
    return fail("CasState");
  }
  if (!isValidTicket(ticket)) {
    return fail("CasTicket");
  }

  // Must be byte-for-byte the service we sent to CAS at login.
  const service = buildServiceUrl(origin, state);

  try {
    await signIn(CAS_PROVIDER_ID, { ticket, service, redirectTo: returnPath });
  } catch (error) {
    // signIn() signals success by throwing Next's redirect — let it propagate.
    if (error instanceof AuthError) {
      console.warn(`[auth] CAS sign-in failed: ${error.type}`);
      return fail(error.type === "CredentialsSignin" ? "CasValidation" : "CasUnavailable");
    }
    throw error;
  }

  // Unreachable in practice: signIn() always redirects.
  return fail("Default");
}
