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

  test("does not resolve an ambiguous short alias", () => {
    expect(
      resolveEventLocation(
        { text: "ARC" },
        context({
          locationAliases: [
            { aliasNormalized: "arc", locationId: "frist" },
            { aliasNormalized: "arc", locationId: "mccosh" },
          ],
        }),
      ),
    ).toEqual({ locationId: "tba", room: null, resolution: "unresolved" });
  });

  test("walks a matching gazetteer room up to a canonical building", () => {
    expect(
      resolveEventLocation(
        { text: "McCosh 50" },
        context({
          gazetteer: [
            { id: "mccosh-50", name: "McCosh 50", parent_id: "mccosh" },
            { id: "mccosh", name: "McCosh Hall", parent_id: null },
          ],
        }),
      ),
    ).toEqual({ locationId: "mccosh", room: "50", resolution: "gazetteer" });
  });

  test("parses a room from text when InboxEngine did not provide one", () => {
    expect(resolveEventLocation({ text: "McCosh Hall, Room 50" }, context())).toEqual({
      locationId: "mccosh",
      room: "50",
      resolution: "fuzzy",
    });
  });

  test("conservatively resolves a partial venue phrase", () => {
    expect(resolveEventLocation({ text: "Frist lawn tent" }, context())).toEqual({
      locationId: "frist",
      room: null,
      resolution: "fuzzy",
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
