/**
 * Forum preference areas, matching the labels in profile-options.ts rather
 * than the legacy enum's compass names. Keep these rules local to Forum.
 */
import type { campusRegionEnum } from "./schema";

export type CampusArea = (typeof campusRegionEnum.enumValues)[number];

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Stable InboxEngine IDs resolve known overlaps without changing its gazetteer.
const VENUE_AREAS: Readonly<Record<string, CampusArea>> = {
  "lewis-library": "east",
  "lewis-science-library": "east",
  "architecture-laboratory": "east",
  "engineering-library": "east",
  "lewis-thomas-laboratory": "east",
  "moffett-laboratory": "east",
  "schultz-laboratory": "east",
  "arts-tower": "north",
  "cap-gown": "south",
  cloister: "south",
  tiger: "south",
  "bedford-field": "off-campus",
  "broadmead-field": "off-campus",
  "caldwell-field-house": "off-campus",
  "campbell-field": "off-campus",
  "clarke-field": "off-campus",
  "club-sports": "off-campus",
  "cynthia-lynn-paul-94-field": "off-campus",
  "finney-field": "off-campus",
  "frelinghuysen-field": "off-campus",
  "lake-field": "off-campus",
  "myslik-field": "off-campus",
  "pardee-field": "off-campus",
  "plummer-field": "off-campus",
  "poe-field": "off-campus",
  "powers-field": "off-campus",
  "princeton-club-softball": "off-campus",
  "roberts-field-student-athlete-facilities": "off-campus",
  "sherrerd-field": "off-campus",
  "track-and-field": "off-campus",
  "white-peff-03-field": "off-campus",
};

// Specific venues resolve overlapping areas (e.g. athletics beside science).
const VENUE_RULES: readonly [RegExp, CampusArea][] = [
  [
    /\b(dillon|denunzio|de nunzio|lenz|jadwin gym|jadwin gymnasium|stadium|weaver track)\b/i,
    "off-campus",
  ],
  [/\b(mccarter|lewis center|lewis arts|wallace dance|effron|berlind)\b/i, "north"],
  [/\b(butler|whitman|yeh|new college west|forbes|rockefeller|mathey)\b/i, "west"],
  [
    /\b(terrace|ivy club|tiger inn|tiger club|cottage club|cap and gown|colonial club|quadrangle club|charter club|tower club|cloister club|cloak|cannon club)\b/i,
    "south",
  ],
  [/\b(frist|nassau hall|1879 hall|firestone|mccosh|chapel|prospect house)\b/i, "central"],
  [
    /\b(equad|e quad|engineering quad|friend center|computer science|jadwin hall|fine hall|frick|robertson|lewis (science )?library)\b/i,
    "east",
  ],
];

/**
 * Unknown/placeholder coordinates are neutral. For other campus venues, use
 * ordered geographic bands, with explicit venue rules taking precedence.
 * These are product preference zones, not official University boundaries.
 */
export function campusAreaForLocation(location: Location): CampusArea | null {
  const { latitude: lat, longitude: lon } = location;
  if (
    /^(tba|other)$/i.test(location.id) ||
    /\b(tba|to be announced|off-campus)\b/i.test(location.name) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 40.335 ||
    lat > 40.355 ||
    lon < -74.67 ||
    lon > -74.64
  )
    return null;

  if (Object.hasOwn(VENUE_AREAS, location.id)) return VENUE_AREAS[location.id] ?? null;
  const label = `${location.id} ${location.name}`
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
  for (const [pattern, area] of VENUE_RULES) {
    if (pattern.test(label)) return area;
  }
  if (lat < 40.3445 && lon > -74.655) return "off-campus";
  if (lon < -74.66 && lat < 40.3485) return "north";
  if (lat < 40.3455 && lon <= -74.655) return "west";
  if (lat >= 40.347 && lat <= 40.3492 && lon > -74.655 && lon < -74.6495) return "south";
  if (lon > -74.654) return "east";
  return "central";
}
