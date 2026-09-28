import { describe, expect, test } from "bun:test";
import {
  buildLoginUrl,
  buildLogoutUrl,
  buildServiceUrl,
  buildServiceValidateUrl,
  generateState,
  isExpectedServiceUrl,
  isValidState,
  isValidTicket,
  normalizeCasBaseUrl,
  normalizeNetId,
  parseServiceValidateResponse,
  safeCompare,
  sanitizeReturnPath,
  validateServiceTicket,
} from "./cas";

const BASE = "https://fed.princeton.edu/cas/";
const ORIGIN = "https://forum.example.edu";

const success = (user: string, extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>${user}</cas:user>
    ${extra}
  </cas:authenticationSuccess>
</cas:serviceResponse>`;

const failure = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_TICKET">Ticket ST-1 not recognized</cas:authenticationFailure>
</cas:serviceResponse>`;

describe("parseServiceValidateResponse", () => {
  test("extracts and lowercases the NetID on success", () => {
    expect(parseServiceValidateResponse(success("IAmin"))).toEqual({ ok: true, netId: "iamin" });
  });

  test("keeps numeric-looking NetIDs as strings", () => {
    expect(parseServiceValidateResponse(success("01234"))).toEqual({ ok: true, netId: "01234" });
  });

  test("ignores attributes block", () => {
    const attrs =
      "<cas:attributes><cas:mail>someone@else.edu</cas:mail><cas:displayname>X</cas:displayname></cas:attributes>";
    expect(parseServiceValidateResponse(success("abc123", attrs))).toEqual({
      ok: true,
      netId: "abc123",
    });
  });

  test("reports authenticationFailure with its code", () => {
    expect(parseServiceValidateResponse(failure)).toEqual({
      ok: false,
      reason: "failure",
      code: "INVALID_TICKET",
    });
  });

  test("rejects users that aren't valid NetIDs", () => {
    for (const bad of [
      "iamin@princeton.edu",
      "evil user",
      "",
      "a".repeat(41),
      "../etc",
      "&lt;x&gt;",
    ]) {
      expect(parseServiceValidateResponse(success(bad))).toEqual({
        ok: false,
        reason: "invalid_user",
      });
    }
  });

  test("does not expand entities", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY x "admin">]>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess><cas:user>&x;</cas:user></cas:authenticationSuccess>
</cas:serviceResponse>`;
    const result = parseServiceValidateResponse(xml);
    expect(result.ok).toBe(false);
  });

  test("rejects malformed / unrelated documents", () => {
    expect(parseServiceValidateResponse("not xml at all").ok).toBe(false);
    expect(parseServiceValidateResponse("<html><body>hi</body></html>")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(parseServiceValidateResponse("<cas:serviceResponse/>").ok).toBe(false);
  });
});

describe("normalizeNetId", () => {
  test("accepts letters, digits, underscore, hyphen", () => {
    expect(normalizeNetId("Ab_c-9")).toBe("ab_c-9");
  });
  test("rejects non-strings", () => {
    expect(normalizeNetId(123)).toBeNull();
    expect(normalizeNetId(undefined)).toBeNull();
    expect(normalizeNetId({ "#text": "x" })).toBeNull();
  });
});

describe("sanitizeReturnPath", () => {
  test("keeps local paths with query and hash", () => {
    expect(sanitizeReturnPath("/events/create")).toBe("/events/create");
    expect(sanitizeReturnPath("/explore?search=a%20b#top")).toBe("/explore?search=a%20b#top");
  });

  test("falls back for anything that could leave the origin", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "explore",
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/foo\\bar",
      "/\t/evil.com",
      "javascript:alert(1)",
      "/api/auth/cas/login",
      "/api/auth",
      `/${"a".repeat(600)}`,
    ]) {
      expect(sanitizeReturnPath(bad)).toBe("/explore");
    }
  });

  test("uses the supplied fallback", () => {
    expect(sanitizeReturnPath("https://evil.com", "/")).toBe("/");
  });
});

describe("state + ticket helpers", () => {
  test("generateState is 64 hex chars and unique", () => {
    const a = generateState();
    const b = generateState();
    expect(isValidState(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  test("isValidState rejects wrong shapes", () => {
    expect(isValidState("abc")).toBe(false);
    expect(isValidState("G".repeat(64))).toBe(false);
    expect(isValidState(null)).toBe(false);
  });

  test("safeCompare", () => {
    expect(safeCompare("abc", "abc")).toBe(true);
    expect(safeCompare("abc", "abd")).toBe(false);
    expect(safeCompare("abc", "abcd")).toBe(false);
  });

  test("isValidTicket", () => {
    expect(isValidTicket("ST-12345-abcDEF_ghi-cas01.princeton.edu")).toBe(true);
    expect(isValidTicket("")).toBe(false);
    expect(isValidTicket("ST-1 2")).toBe(false);
    expect(isValidTicket("ST-1&service=x")).toBe(false);
    expect(isValidTicket("x".repeat(513))).toBe(false);
    expect(isValidTicket(undefined)).toBe(false);
  });
});

describe("URL builders", () => {
  const state = "a".repeat(64);
  const service = buildServiceUrl(ORIGIN, state);

  test("service URL", () => {
    expect(service).toBe(`${ORIGIN}/api/auth/cas/callback?state=${state}`);
  });

  test("login URL encodes the service", () => {
    expect(buildLoginUrl(BASE, service)).toBe(
      `${BASE}login?service=${encodeURIComponent(service)}`,
    );
    expect(buildLoginUrl("https://fed.princeton.edu/cas", service)).toBe(
      `${BASE}login?service=${encodeURIComponent(service)}`,
    );
  });

  test("serviceValidate URL encodes service and ticket", () => {
    expect(buildServiceValidateUrl(BASE, service, "ST-1")).toBe(
      `${BASE}serviceValidate?service=${encodeURIComponent(service)}&ticket=ST-1`,
    );
  });

  test("logout URL", () => {
    expect(buildLogoutUrl(BASE)).toBe(`${BASE}logout`);
    expect(buildLogoutUrl(BASE, `${ORIGIN}/`)).toBe(
      `${BASE}logout?service=${encodeURIComponent(`${ORIGIN}/`)}`,
    );
  });

  test("normalizeCasBaseUrl", () => {
    expect(normalizeCasBaseUrl("https://x/cas")).toBe("https://x/cas/");
    expect(normalizeCasBaseUrl("https://x/cas///")).toBe("https://x/cas/");
  });
});

describe("isExpectedServiceUrl", () => {
  const state = "b".repeat(64);
  const good = buildServiceUrl(ORIGIN, state);

  test("accepts our own callback URL", () => {
    expect(isExpectedServiceUrl(good, ORIGIN)).toBe(true);
    expect(isExpectedServiceUrl(good, `${ORIGIN}/api/auth`)).toBe(true);
  });

  test("rejects other origins, paths, and extra params", () => {
    for (const bad of [
      buildServiceUrl("https://evil.com", state),
      buildServiceUrl("http://forum.example.edu", state),
      `${ORIGIN}/api/auth/cas/other?state=${state}`,
      `${good}&ticket=ST-1`,
      `${good}&x=1`,
      `${good}#frag`,
      `${ORIGIN}/api/auth/cas/callback?state=short`,
      `${ORIGIN}/api/auth/cas/callback`,
      "not a url",
      undefined,
      42,
    ]) {
      expect(isExpectedServiceUrl(bad, ORIGIN)).toBe(false);
    }
  });
});

describe("validateServiceTicket", () => {
  const service = buildServiceUrl(ORIGIN, "c".repeat(64));

  const fakeFetch = (body: string, status = 200, seen?: { url?: string }) =>
    (async (input: RequestInfo | URL) => {
      if (seen) seen.url = String(input);
      return new Response(body, { status });
    }) as unknown as typeof fetch;

  test("calls serviceValidate with the same service and returns the NetID", async () => {
    const seen: { url?: string } = {};
    const result = await validateServiceTicket({
      casBaseUrl: BASE,
      service,
      ticket: "ST-42",
      fetchImpl: fakeFetch(success("TigerUser"), 200, seen),
    });
    expect(result).toEqual({ ok: true, netId: "tigeruser" });
    expect(seen.url).toBe(buildServiceValidateUrl(BASE, service, "ST-42"));
  });

  test("returns failure for CAS authenticationFailure", async () => {
    const result = await validateServiceTicket({
      casBaseUrl: BASE,
      service,
      ticket: "ST-42",
      fetchImpl: fakeFetch(failure),
    });
    expect(result.ok).toBe(false);
  });

  test("rejects malformed tickets without calling CAS", async () => {
    let called = false;
    const result = await validateServiceTicket({
      casBaseUrl: BASE,
      service,
      ticket: "bad ticket",
      fetchImpl: (async () => {
        called = true;
        return new Response("");
      }) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  test("throws on non-2xx so callers treat CAS as unavailable", async () => {
    await expect(
      validateServiceTicket({
        casBaseUrl: BASE,
        service,
        ticket: "ST-42",
        fetchImpl: fakeFetch("oops", 503),
      }),
    ).rejects.toThrow("HTTP 503");
  });
});
