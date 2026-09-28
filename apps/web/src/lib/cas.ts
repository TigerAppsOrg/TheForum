/**
 * Princeton CAS (Central Authentication Service) protocol helpers.
 *
 * Pure, framework-agnostic functions so they can be unit-tested with `bun test`
 * without booting Next.js or validating env vars. Anything that needs env or
 * request context lives in `~/lib/cas-server.ts` / the route handlers.
 *
 * Flow (CAS protocol v2):
 *   1. /api/auth/cas/login  → redirect to `${base}login?service=<service>`
 *   2. CAS redirects back to `<service>&ticket=ST-…`
 *   3. Server calls `${base}serviceValidate?service=<service>&ticket=<ticket>`
 *      and reads `serviceResponse.authenticationSuccess.user` (the NetID).
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

export const DEFAULT_CAS_BASE_URL = "https://fed.princeton.edu/cas/";

/** Path of our CAS callback route (the CAS "service"). */
export const CAS_CALLBACK_PATH = "/api/auth/cas/callback";

/** Cookie holding the anti-CSRF `state` for an in-flight login. */
export const CAS_STATE_COOKIE = "forum_cas_state";
/** Cookie holding the sanitized local path to return to after login. */
export const CAS_RETURN_COOKIE = "forum_cas_return";
/** Both cookies are only needed by the CAS login/callback routes. */
export const CAS_COOKIE_PATH = "/api/auth/cas";
/** Lifetime of the state + return cookies (10 minutes). */
export const CAS_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export const CAS_VALIDATE_TIMEOUT_MS = 15_000;

export const DEFAULT_RETURN_PATH = "/explore";

const NETID_RE = /^[a-z0-9_-]{1,40}$/i;
const STATE_RE = /^[a-f0-9]{64}$/;
// CAS service tickets look like `ST-12345-abcDEF…-cas01`. Be permissive about the
// charset but bounded, and reject anything with whitespace/control characters.
const TICKET_RE = /^[A-Za-z0-9._:-]{1,512}$/;

/** Ensure the CAS base URL ends in exactly one `/` so path joins are safe. */
export function normalizeCasBaseUrl(base: string): string {
  return `${base.replace(/\/+$/, "")}/`;
}

/** 32 random bytes, hex-encoded (64 chars). */
export function generateState(): string {
  return randomBytes(32).toString("hex");
}

export function isValidState(state: unknown): state is string {
  return typeof state === "string" && STATE_RE.test(state);
}

export function isValidTicket(ticket: unknown): ticket is string {
  return typeof ticket === "string" && TICKET_RE.test(ticket);
}

/** Constant-time string comparison (length mismatch → false, still no early exit on content). */
export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Compare against itself so timing doesn't depend on where strings differ.
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/** Validate a CAS username and normalize it to a lowercase NetID. */
export function normalizeNetId(user: unknown): string | null {
  if (typeof user !== "string") return null;
  const trimmed = user.trim();
  if (!NETID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Sanitize a user-supplied "return to" value into a same-origin path.
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`), backslash
 * tricks (`/\evil.com`), and control characters. Falls back to `fallback`.
 */
export function sanitizeReturnPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_RETURN_PATH,
): string {
  if (!value || typeof value !== "string") return fallback;
  if (value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally rejecting control chars
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  // Never bounce back into the auth flow itself.
  if (value === "/api/auth" || value.startsWith("/api/auth/")) return fallback;
  try {
    // Resolve against a dummy origin; if the origin changes, it wasn't a local path.
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Build the CAS `service` URL for a login attempt. */
export function buildServiceUrl(origin: string, state: string): string {
  const url = new URL(CAS_CALLBACK_PATH, origin);
  url.search = new URLSearchParams({ state }).toString();
  return url.toString();
}

/**
 * Check that a `service` URL is exactly one we would have generated for
 * `expectedOrigin`. This prevents redeeming a ticket that CAS issued to a
 * *different* service (e.g. a malicious site the victim logged into).
 */
export function isExpectedServiceUrl(service: unknown, expectedOrigin: string): boolean {
  if (typeof service !== "string" || service.length > 2048) return false;
  let url: URL;
  let origin: string;
  try {
    url = new URL(service);
    origin = new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  if (url.pathname !== CAS_CALLBACK_PATH) return false;
  if (url.hash) return false;
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== "state") return false;
  const state = url.searchParams.get("state");
  if (!isValidState(state)) return false;
  // Must round-trip to the exact canonical form we generate.
  return buildServiceUrl(origin, state) === service;
}

export function buildLoginUrl(casBaseUrl: string, service: string): string {
  return `${normalizeCasBaseUrl(casBaseUrl)}login?service=${encodeURIComponent(service)}`;
}

export function buildServiceValidateUrl(
  casBaseUrl: string,
  service: string,
  ticket: string,
): string {
  return `${normalizeCasBaseUrl(casBaseUrl)}serviceValidate?service=${encodeURIComponent(
    service,
  )}&ticket=${encodeURIComponent(ticket)}`;
}

export function buildLogoutUrl(casBaseUrl: string, service?: string): string {
  const base = `${normalizeCasBaseUrl(casBaseUrl)}logout`;
  return service ? `${base}?service=${encodeURIComponent(service)}` : base;
}

export type CasValidationResult =
  | { ok: true; netId: string }
  | { ok: false; reason: "failure" | "invalid_user" | "malformed"; code?: string };

const parser = new XMLParser({
  removeNSPrefix: true,
  // Don't expand entities (no XXE / billion-laughs style surprises).
  processEntities: false,
  // Keep values as strings — a numeric NetID must not become a number.
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function textOf(node: unknown): unknown {
  if (node && typeof node === "object" && "#text" in node) {
    return (node as { "#text": unknown })["#text"];
  }
  return node;
}

/**
 * Parse a CAS v2 `serviceValidate` XML response.
 * CAS is the authority on identity: on success we return its `user` as the NetID.
 */
export function parseServiceValidateResponse(xml: string): CasValidationResult {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const response = (doc as { serviceResponse?: Record<string, unknown> } | null)?.serviceResponse;
  if (!response || typeof response !== "object") return { ok: false, reason: "malformed" };

  if ("authenticationFailure" in response) {
    const failure = response.authenticationFailure;
    const code =
      failure && typeof failure === "object" && "@_code" in failure
        ? String((failure as { "@_code": unknown })["@_code"])
        : undefined;
    return { ok: false, reason: "failure", code };
  }

  const success = response.authenticationSuccess;
  if (!success || typeof success !== "object") return { ok: false, reason: "malformed" };
  const user = textOf((success as { user?: unknown }).user);
  const netId = normalizeNetId(user);
  if (!netId) return { ok: false, reason: "invalid_user" };
  return { ok: true, netId };
}

/**
 * Validate a service ticket against CAS (server-side). Never trust a NetID from
 * the client — only what CAS returns here.
 */
export async function validateServiceTicket(opts: {
  casBaseUrl: string;
  service: string;
  ticket: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<CasValidationResult> {
  const { casBaseUrl, service, ticket, timeoutMs = CAS_VALIDATE_TIMEOUT_MS } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!isValidTicket(ticket)) return { ok: false, reason: "failure", code: "INVALID_TICKET" };

  const res = await fetchImpl(buildServiceValidateUrl(casBaseUrl, service, ticket), {
    method: "GET",
    headers: { Accept: "application/xml, text/xml" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`CAS serviceValidate returned HTTP ${res.status}`);
  }
  return parseServiceValidateResponse(await res.text());
}
