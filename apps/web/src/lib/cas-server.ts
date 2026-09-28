/**
 * Server-only CAS helpers that depend on env / request context.
 * Pure protocol helpers live in `~/lib/cas.ts`.
 */

import { env } from "~/env";
import { DEFAULT_CAS_BASE_URL, normalizeCasBaseUrl } from "~/lib/cas";

// `??` covers SKIP_ENV_VALIDATION builds, where zod defaults are not applied.
export const casBaseUrl = normalizeCasBaseUrl(env.CAS_BASE_URL ?? DEFAULT_CAS_BASE_URL);

let warnedMissingAuthUrl = false;

/**
 * Public origin of the app, used to build the CAS `service` URL.
 *
 * Mirrors how Auth.js derives its own URLs (`createActionURL`): `AUTH_URL` wins;
 * otherwise the (forwarded) Host header. Keeping the two identical matters —
 * the Credentials `authorize()` check compares the service origin against the
 * origin Auth.js computed for the same request.
 *
 * Set `AUTH_URL` in production so the origin can't be influenced by headers.
 */
export function getAppOrigin(headers: Headers, fallbackProtocol = "https:"): string {
  if (env.AUTH_URL) return new URL(env.AUTH_URL).origin;

  if (env.NODE_ENV === "production" && !warnedMissingAuthUrl) {
    warnedMissingAuthUrl = true;
    console.warn(
      "[auth] AUTH_URL is not set; deriving the CAS service origin from request headers. Set AUTH_URL in production.",
    );
  }

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) throw new Error("Cannot determine request host (set AUTH_URL)");
  const proto = headers.get("x-forwarded-proto") ?? fallbackProtocol;
  return new URL(`${proto.endsWith(":") ? proto : `${proto}:`}//${host}`).origin;
}
