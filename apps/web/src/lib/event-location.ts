type EventLocationInput = {
  locationId?: string | null;
  locationName?: string | null;
  locationDetail?: string | null;
  locationText?: string | null;
};

function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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
  return normalizeLocationText(locationText) !== normalizeLocationText(locationName);
}
