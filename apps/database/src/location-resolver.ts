export type CampusLocation = {
  id: string;
  name: string;
};

export type LocationAlias = {
  aliasNormalized: string;
  locationId: string;
};

export type GazetteerPlace = {
  id: string | number;
  name: string | null;
  alt_name?: string | null;
  parent_id?: string | number | null;
};

export type EventLocation = {
  id?: string | null;
  text?: string | null;
  room?: string | number | null;
  online?: boolean | null;
};

export type LocationResolverContext = {
  campusLocations: readonly CampusLocation[];
  locationAliases: readonly LocationAlias[];
  gazetteer?: readonly GazetteerPlace[];
};

export type LocationResolution =
  | "engine"
  | "online"
  | "alias"
  | "gazetteer"
  | "fuzzy"
  | "manual"
  | "unresolved";

export type ResolvedEventLocation = {
  locationId: string;
  room: string | null;
  resolution: LocationResolution;
};

const TBA_LOCATION_ID = "tba";
const ONLINE_LOCATION_ID = "online";

const NOISE_WORDS = new Set([
  "the",
  "a",
  "an",
  "at",
  "in",
  "on",
  "of",
  "and",
  "hall",
  "building",
  "center",
  "centre",
  "campus",
  "room",
  "rm",
]);

/** Normalization deliberately mirrors the value stored in `alias_normalized`. */
export function normalizeLocationText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function roomFrom(location: EventLocation): string | null {
  if (location.room !== undefined && location.room !== null && String(location.room).trim())
    return String(location.room).trim();

  const text = location.text?.trim();
  if (!text) return null;
  // Keep the existing useful convention: "McCosh 50" means room 50.  Do not
  // treat a building's embedded number (e.g. 185 Nassau) as a room.
  const match = text.match(/(?:\b(?:room|rm)\.?\s*|[\s,/#-])(\d{1,5}[a-z]?)\s*$/i);
  return match?.[1] ?? null;
}

function textWithoutRoom(text: string): string {
  return text
    .replace(/\b(?:room|rm)\.?\s*\d{1,5}[a-z]?\s*$/i, "")
    .replace(/[\s,/#-]+\d{1,5}[a-z]?\s*$/i, "")
    .trim();
}

/** Exact alias keys, ordered from the most specific to the building-level form. */
export function locationAliasKeys(text: string): string[] {
  return [
    ...new Set([normalizeLocationText(text), normalizeLocationText(textWithoutRoom(text))]),
  ].filter(Boolean);
}

function placeParentId(place: GazetteerPlace): string | undefined {
  const parent = place.parent_id;
  return parent === undefined || parent === null ? undefined : String(parent);
}

function placeNames(place: GazetteerPlace): string[] {
  return [place.name, place.alt_name]
    .filter((name): name is string => Boolean(name))
    .map(normalizeLocationText);
}

function fuzzyWords(value: string): string[] {
  return normalizeLocationText(value)
    .split(" ")
    .filter((word) => word && !NOISE_WORDS.has(word) && !/^\d+[a-z]?$/.test(word));
}

/**
 * Resolves a feed location without guessing when a short or incomplete phrase
 * could identify multiple places. `ctx` is intentionally data-only: callers
 * can load its three collections once for an entire InboxEngine sync.
 */
export function resolveEventLocation(
  engineLocation: EventLocation,
  ctx: LocationResolverContext,
): ResolvedEventLocation {
  const room = roomFrom(engineLocation);
  const unresolved = (): ResolvedEventLocation => ({
    locationId: TBA_LOCATION_ID,
    room,
    resolution: "unresolved",
  });
  const byId = new Map(ctx.campusLocations.map((location) => [location.id, location]));

  // An Engine ID is authoritative only when it is a current Forum location.
  if (engineLocation.id && byId.has(engineLocation.id))
    return { locationId: engineLocation.id, room, resolution: "engine" };

  // resolve online events
  if (engineLocation.online)
    return { locationId: ONLINE_LOCATION_ID, room: null, resolution: "online" };

  const sourceText = engineLocation.text?.trim();
  if (!sourceText) return unresolved();
  const venueText = textWithoutRoom(sourceText);
  const fullNormalized = normalizeLocationText(sourceText);
  const normalized = normalizeLocationText(venueText);
  if (!normalized) return unresolved();

  // Check a room-specific alias before the room-free building alias. The
  // primary key in location_aliases prevents ambiguity in stored data.
  for (const aliasKey of locationAliasKeys(sourceText)) {
    const aliases = ctx.locationAliases.filter(
      (alias) => alias.aliasNormalized === aliasKey && byId.has(alias.locationId),
    );
    if (aliases.length > 1) return unresolved();
    const [alias] = aliases;
    if (alias) return { locationId: alias.locationId, room, resolution: "alias" };
  }

  const places = ctx.gazetteer ?? [];
  const placesById = new Map(places.map((place) => [String(place.id), place]));
  const locationIdsByName = new Map<string, Set<string>>();
  for (const location of ctx.campusLocations) {
    const name = normalizeLocationText(location.name);
    if (!name) continue;
    const locationIds = locationIdsByName.get(name) ?? new Set<string>();
    locationIds.add(location.id);
    locationIdsByName.set(name, locationIds);
  }
  // Try the complete text too: named rooms ("McCosh 50") live in the
  // gazetteer and lead to their parent building, while aliases are building
  // names and therefore use the room-free text above.
  const matchingPlaces = places.filter((place) => {
    const names = placeNames(place);
    return names.includes(fullNormalized) || names.includes(normalized);
  });
  const gazetteerTargets = new Set<string>();
  for (const place of matchingPlaces) {
    let current: GazetteerPlace | undefined = place;
    const seen = new Set<string>();
    while (current && !seen.has(String(current.id))) {
      const id = String(current.id);
      seen.add(id);
      const parent = placesById.get(placeParentId(current) ?? "");
      if (!parent) {
        // Princeton map POIs use numeric IDs, whereas Forum locations use
        // slugs. Once we reach the top-level POI, translate its canonical
        // name to a Forum location instead of comparing those unrelated IDs.
        for (const name of placeNames(current)) {
          for (const locationId of locationIdsByName.get(name) ?? [])
            gazetteerTargets.add(locationId);
        }
        break;
      }
      current = parent;
    }
  }
  if (gazetteerTargets.size === 1) {
    const [locationId] = gazetteerTargets;
    if (locationId) return { locationId, room, resolution: "gazetteer" };
  }

  const phraseWords = fuzzyWords(venueText);
  if (!phraseWords.length) return unresolved();
  const candidates = ctx.campusLocations.filter((location) => {
    if (location.id === TBA_LOCATION_ID || location.id === ONLINE_LOCATION_ID) return false;
    const nameWords = fuzzyWords(location.name);
    if (!nameWords.length || !nameWords.every((word) => phraseWords.includes(word))) return false;
    // A venue name appearing somewhere in a longer phrase is not enough: it
    // must explain most of the supplied location wording.
    return nameWords.length / phraseWords.length >= 0.75;
  });
  if (candidates.length === 1) return { locationId: candidates[0].id, room, resolution: "fuzzy" };

  return unresolved();
}
