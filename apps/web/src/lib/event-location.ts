type EventLocationInput = {
  locationId?: string | null;
  locationName?: string | null;
  locationDetail?: string | null;
  locationText?: string | null;
};

const ignoredWords = new Set(["the", "hall", "building", "center", "centre", "campus"]);

function meaningfulWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !ignoredWords.has(word));
}

/** The one display string used for event locations across the app. */
export function formatEventLocation({
  locationId,
  locationName,
  locationDetail,
  locationText,
}: EventLocationInput): string {
  if (locationId === "online") return "Online";
  if (locationId === "tba") return locationText?.trim() || "Location TBA";
  if (locationName) return locationDetail ? `${locationName} · ${locationDetail}` : locationName;
  return locationText?.trim() || "Location TBA";
}

/** Whether the source wording is useful to show beneath a resolved venue. */
export function originalLocationDiffers({
  locationId,
  locationName,
  locationText,
}: EventLocationInput) {
  if (!locationName || !locationText || locationId === "online" || locationId === "tba")
    return false;
  const venueWords = meaningfulWords(locationName);
  const sourceWords = meaningfulWords(locationText);
  return sourceWords.length > 0 && !sourceWords.some((word) => venueWords.includes(word));
}
