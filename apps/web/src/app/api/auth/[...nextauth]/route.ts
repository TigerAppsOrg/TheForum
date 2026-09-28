import type { NextRequest } from "next/server";
import { CAS_PROVIDER_ID, handlers } from "~/auth";

export const { GET } = handlers;

/**
 * The CAS Credentials provider must only be driven by our own
 * `/api/auth/cas/callback` route (which verifies the `state` cookie and calls
 * `signIn()` in-process). Refuse direct HTTP POSTs to its Auth.js endpoints.
 *
 * Defense in depth only: `authorize()` independently validates the ticket with
 * CAS and pins the service URL to our origin.
 */
const blockedPaths = new Set([
  `/api/auth/callback/${CAS_PROVIDER_ID}`,
  `/api/auth/signin/${CAS_PROVIDER_ID}`,
]);

export function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "");
  if (blockedPaths.has(pathname)) {
    return new Response("Not found", { status: 404 });
  }
  return handlers.POST(req);
}
