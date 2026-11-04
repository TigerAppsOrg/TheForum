import { describe, expect, test } from "bun:test";

import { formatEventLocation, originalLocationDiffers } from "./event-location";

describe("formatEventLocation", () => {
  test("formats a resolved venue and room", () => {
    expect(
      formatEventLocation({
        locationId: "mccosh",
        locationName: "McCosh Hall",
        locationDetail: "Room 50",
        locationText: "McCosh 50",
      }),
    ).toBe("McCosh Hall · Room 50");
  });

  test("uses source text alone for unresolved locations", () => {
    expect(
      formatEventLocation({
        locationId: "tba",
        locationName: "Location TBA",
        locationDetail: "Smith Lounge",
        locationText: "Smith Lounge",
      }),
    ).toBe("Smith Lounge");
  });

  test("uses Online and Location TBA special labels", () => {
    expect(formatEventLocation({ locationId: "online" })).toBe("Online");
    expect(formatEventLocation({ locationId: "tba" })).toBe("Location TBA");
  });

  test("identifies source wording with no meaningful venue word in common", () => {
    expect(
      originalLocationDiffers({
        locationId: "frist",
        locationName: "Frist Campus Center",
        locationText: "Smith Lounge",
      }),
    ).toBe(true);
  });
});
