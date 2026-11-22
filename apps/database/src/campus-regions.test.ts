import { expect, test } from "bun:test";
import { campusAreaForLocation } from "./campus-regions";

const location = (name: string, latitude = 40.347, longitude = -74.657) => ({
  id: name,
  name,
  latitude,
  longitude,
});

test("venue overrides match the existing settings labels, not legacy compass names", () => {
  for (const [name, area] of [
    ["Frist Campus Center", "central"],
    ["Engineering Quad", "east"],
    ["Terrace Club", "south"],
    ["Whitman College", "west"],
    ["Lewis Center for the Arts", "north"],
    ["Dillon Gym", "off-campus"],
    ["Jadwin Hall", "east"],
    ["Jadwin Gymnasium", "off-campus"],
  ] as const)
    expect(campusAreaForLocation(location(name))).toBe(area);
});

test("placeholder, outside-campus and invalid coordinates stay unmapped", () => {
  for (const row of [
    location("TBA"),
    location("Other / Off-Campus"),
    location("Unknown", 0, 0),
    location("Unknown", 41, -74),
    location("Unknown", Number.NaN),
    location("Unknown", 40.347, Number.POSITIVE_INFINITY),
  ]) {
    expect(campusAreaForLocation(row)).toBeNull();
  }
});

test("new venues get deterministic coordinate-based regions", () => {
  for (const [lat, lon, area] of [
    [40.347, -74.657, "central"],
    [40.35, -74.65, "east"],
    [40.344, -74.658, "west"],
    [40.347, -74.653, "south"],
    [40.346, -74.662, "north"],
    [40.342, -74.65, "off-campus"],
  ] as const)
    expect(campusAreaForLocation(location("New venue", lat, lon))).toBe(area);
});

test("real upstream venues resolve science, clubs, arts and athletics overlaps", async () => {
  const catalog: { locations: ReturnType<typeof location>[] } = await Bun.file(
    `${import.meta.dir}/../../../packages/inbox-engine/src/events/data/campus-locations.json`,
  ).json();
  for (const [id, area] of [
    ["lewis-library", "east"],
    ["lewis-science-library", "east"],
    ["architecture-laboratory", "east"],
    ["cap-gown", "south"],
    ["cloister", "south"],
    ["tiger", "south"],
    ["arts-tower", "north"],
    ["clarke-field", "off-campus"],
    ["myslik-field", "off-campus"],
    ["broadmead-field", "off-campus"],
    ["finney-field", "off-campus"],
    ["powers-field", "off-campus"],
    ["frelinghuysen-field", "off-campus"],
  ] as const) {
    const venue = catalog.locations.find((row) => row.id === id);
    expect(venue).toBeDefined();
    if (venue) expect(campusAreaForLocation(venue)).toBe(area);
  }
});

test("known IDs take precedence over names and aliases normalize punctuation", () => {
  expect(campusAreaForLocation({ ...location("Renamed venue"), id: "cap-gown" })).toBe("south");
  for (const name of ["Cap & Gown Club", "Cap-and-Gown Club", "Cap   and   Gown Club"])
    expect(campusAreaForLocation(location(name, 40.348336, -74.651008))).toBe("south");
  expect(campusAreaForLocation(location("E-Quad"))).toBe("east");
  expect(campusAreaForLocation(location("Lewis Science Library", 40.346166, -74.652838))).toBe(
    "east",
  );
  // Coordinate-only venues east or south of the clubs must not become Prospect Ave.
  expect(campusAreaForLocation(location("Unknown", 40.3465, -74.652))).toBe("east");
  expect(campusAreaForLocation(location("Unknown", 40.3475, -74.648))).toBe("east");
  expect(campusAreaForLocation({ ...location("TBA"), id: "cap-gown" })).toBeNull();
});
