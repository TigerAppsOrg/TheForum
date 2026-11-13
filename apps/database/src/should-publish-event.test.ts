import { describe, expect, test } from "bun:test";
import type { EngineEvent } from "../../../packages/inbox-engine/src/client/index.ts";
import { shouldPublishEvent } from "./should-publish-event";

const event = {
  id: "event",
  status: "active",
  publishable: false,
  timePrecision: "exact",
  confidence: 0.7,
  location: { text: null, online: false },
  startsAt: "2026-11-15T12:00:00Z",
  endsAt: null,
  series: null,
} as EngineEvent;
const now = new Date("2026-11-13T12:00:00Z").getTime();
const allowed = (value: EngineEvent, flag: boolean) =>
  shouldPublishEvent(value, new Map(), flag, now);

describe("locationless publication", () => {
  test("only admits qualifying events when enabled", () => {
    expect(allowed(event, false)).toBe(false);
    expect(allowed(event, true)).toBe(true);
    expect(allowed({ ...event, confidence: 0.69 }, true)).toBe(false);
    expect(allowed({ ...event, timePrecision: "date" }, true)).toBe(false);
    expect(allowed({ ...event, status: "withdrawn" }, true)).toBe(false);
    expect(allowed({ ...event, location: { ...event.location, text: "Unknown" } }, true)).toBe(
      false,
    );
    expect(allowed({ ...event, location: { ...event.location, online: true } }, true)).toBe(false);
    expect(allowed({ ...event, publishable: true }, false)).toBe(true);
  });
});
