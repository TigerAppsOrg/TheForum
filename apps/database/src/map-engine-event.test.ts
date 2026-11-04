import { describe, expect, test } from "bun:test";

import { type MappableEngineEvent, mapEngineEvent } from "./map-engine-event";

const event = (location: MappableEngineEvent["location"]): MappableEngineEvent => ({
  title: "Office hours",
  summary: null,
  startsAt: "2026-11-02T15:00:00.000Z",
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
});
