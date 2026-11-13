import { describe, expect, test } from "bun:test";

import {
  type LocationResolverContext,
  normalizeLocationText,
  resolveEventLocation,
} from "./location-resolver";

const context = (overrides: Partial<LocationResolverContext> = {}): LocationResolverContext => ({
  campusLocations: [
    { id: "frist", name: "Frist Campus Center" },
    { id: "mccosh", name: "McCosh Hall" },
    { id: "robertson", name: "Robertson Hall" },
  ],
  locationAliases: [],
  gazetteer: [],
  ...overrides,
});

describe("resolveEventLocation", () => {
  test("uses a known InboxEngine location ID before every other signal", () => {
    expect(
      resolveEventLocation({ id: "frist", online: true, text: "McCosh 50" }, context()),
    ).toEqual({
      locationId: "frist",
      room: "50",
      resolution: "engine",
    });
  });

  test("resolves online events after an unknown Engine ID", () => {
    expect(resolveEventLocation({ id: "gone", online: true, text: "Frist" }, context())).toEqual({
      locationId: "online",
      room: null,
      resolution: "online",
    });
  });

  test("uses an exact normalized alias", () => {
    const alias = "Frist C.C.";
    expect(
      resolveEventLocation(
        { text: alias },
        context({
          locationAliases: [{ aliasNormalized: normalizeLocationText(alias), locationId: "frist" }],
        }),
      ),
    ).toEqual({ locationId: "frist", room: null, resolution: "alias" });
  });

  test("uses a room-specific alias before its building-level alias", () => {
    expect(
      resolveEventLocation(
        { text: "McCosh 50" },
        context({
          locationAliases: [
            { aliasNormalized: "mccosh 50", locationId: "frist" },
            { aliasNormalized: "mccosh", locationId: "mccosh" },
          ],
        }),
      ),
    ).toEqual({ locationId: "frist", room: "50", resolution: "alias" });
  });

  test("uses a building-level alias when no room-specific alias exists", () => {
    expect(
      resolveEventLocation(
        { text: "McCosh 50" },
        context({
          locationAliases: [{ aliasNormalized: "mccosh", locationId: "mccosh" }],
        }),
      ),
    ).toEqual({ locationId: "mccosh", room: "50", resolution: "alias" });
  });

  test("walks numeric gazetteer POI IDs up to a canonical Forum location", () => {
    expect(
      resolveEventLocation(
        { text: "Food Gallery at Frist" },
        context({
          gazetteer: [
            { id: 742, name: "Food Gallery at Frist", parent_id: 193 },
            { id: 193, name: "Frist Campus Center", parent_id: null },
          ],
        }),
      ),
    ).toEqual({ locationId: "frist", room: null, resolution: "gazetteer" });
  });

  test("parses a room from text when InboxEngine did not provide one", () => {
    expect(resolveEventLocation({ text: "McCosh Hall, Room 50" }, context())).toEqual({
      locationId: "mccosh",
      room: "50",
      resolution: "fuzzy",
    });
  });

  test("does not fuzzy-match a venue mentioned within a more specific place", () => {
    expect(resolveEventLocation({ text: "Smith Lounge in Frist" }, context())).toEqual({
      locationId: "tba",
      room: null,
      resolution: "unresolved",
    });
    expect(resolveEventLocation({ text: "Frist lawn tent" }, context())).toEqual({
      locationId: "tba",
      room: null,
      resolution: "unresolved",
    });
  });

  test("does not fuzzy-match special locations", () => {
    expect(
      resolveEventLocation(
        { text: "Location TBA" },
        context({
          campusLocations: [
            { id: "tba", name: "Location TBA" },
            { id: "online", name: "Online" },
          ],
        }),
      ),
    ).toEqual({
      locationId: "tba",
      room: null,
      resolution: "unresolved",
    });
  });

  test("returns tba when no resolution is safe", () => {
    expect(resolveEventLocation({ text: "Under the big oak" }, context())).toEqual({
      locationId: "tba",
      room: null,
      resolution: "unresolved",
    });
  });
});
