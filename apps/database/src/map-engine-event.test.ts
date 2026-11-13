import { describe, expect, test } from "bun:test";

import { type MappableEngineEvent, locationChanged, mapEngineEvent } from "./map-engine-event";

const event = (location: MappableEngineEvent["location"]): MappableEngineEvent => ({
  title: "Office hours",
  summary: null,
  startsAt: "2026-11-02T15:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  location,
  source: { kind: "listserv", url: "https://example.com/event" },
  announcements: { emails: 1 },
});

const context = {
  botId: "bot-id",
  orgByExternal: new Map(),
  locationContext: {
    campusLocations: [{ id: "mccosh", name: "McCosh Hall" }],
    locationAliases: [],
    gazetteer: [],
  },
};

describe("mapEngineEvent", () => {
  test("writes source text, parsed room, and the resolver result", () => {
    expect(mapEngineEvent(event({ text: "McCosh Hall, Room 50" }), context)).toMatchObject({
      locationId: "mccosh",
      locationDetail: "Room 50",
      locationText: "McCosh Hall, Room 50",
      locationResolution: "fuzzy",
    });
  });

  test("keeps all location fields from a manual correction", () => {
    expect(
      mapEngineEvent(event({ text: "McCosh Hall, Room 50" }), {
        ...context,
        existingLocation: {
          locationId: "manual-location",
          locationDetail: "Atrium",
          locationText: "Hand-corrected location",
          locationResolution: "manual",
        },
      }),
    ).toMatchObject({
      locationId: "manual-location",
      locationDetail: "Atrium",
      locationText: "Hand-corrected location",
      locationResolution: "manual",
    });
  });

  test("identifies only meaningful location-result changes", () => {
    const existing = {
      locationId: "mccosh",
      locationDetail: "Room 50",
      locationText: "McCosh Hall, Room 50",
      locationResolution: "fuzzy" as const,
    };
    expect(locationChanged(existing, existing)).toBe(false);
    expect(locationChanged(existing, { ...existing, locationResolution: "alias" })).toBe(true);
  });

  test("uses the InboxEngine update timestamp", () => {
    expect(mapEngineEvent(event({ text: "McCosh Hall" }), context).updatedAt).toEqual(
      new Date("2026-11-01T12:00:00.000Z"),
    );
  });
});
