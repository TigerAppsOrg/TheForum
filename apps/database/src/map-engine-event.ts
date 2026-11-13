import {
  type EventLocation,
  type LocationResolution,
  type LocationResolverContext,
  resolveEventLocation,
} from "./location-resolver";

export type MappableEngineEvent = {
  title: string;
  summary?: string | null;
  startsAt: string;
  endsAt?: string | null;
  updatedAt: string;
  location: EventLocation;
  host?: { id: string } | null;
  imageUrl?: string | null;
  rsvpUrl?: string | null;
  source: { kind: string; url?: string | null };
  announcements: { emails: number; firstAnnouncedAt?: string | null };
};

export type ExistingEventLocation = {
  locationId: string;
  locationDetail: string | null;
  locationText: string | null;
  locationResolution: LocationResolution;
};

type MapEngineEventContext = {
  botId: string;
  orgByExternal: ReadonlyMap<string, string>;
  locationContext: LocationResolverContext;
  existingLocation?: ExistingEventLocation;
};

export function locationChanged(
  existing: ExistingEventLocation,
  next: Pick<
    ExistingEventLocation,
    "locationId" | "locationDetail" | "locationText" | "locationResolution"
  >,
): boolean {
  return (
    existing.locationId !== next.locationId ||
    existing.locationDetail !== next.locationDetail ||
    existing.locationText !== next.locationText ||
    existing.locationResolution !== next.locationResolution
  );
}

/**
 * Converts an InboxEngine event into Forum event values without performing I/O.
 * A manual location is an explicit editorial override and therefore survives
 * subsequent InboxEngine syncs unchanged.
 */
export function mapEngineEvent(event: MappableEngineEvent, ctx: MapEngineEventContext) {
  const resolved = resolveEventLocation(event.location, ctx.locationContext);
  const generatedLocation = {
    locationId: resolved.locationId,
    locationDetail:
      [
        resolved.room ? `Room ${resolved.room}` : null,
        resolved.locationId === "tba" ? event.location.text?.trim() : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200) || null,
    locationText: event.location.text?.trim().slice(0, 300) || null,
    locationResolution: resolved.resolution,
  };
  const location =
    ctx.existingLocation?.locationResolution === "manual"
      ? {
          locationId: ctx.existingLocation.locationId,
          locationDetail: ctx.existingLocation.locationDetail,
          locationText: ctx.existingLocation.locationText,
          locationResolution: ctx.existingLocation.locationResolution,
        }
      : generatedLocation;

  return {
    title: event.title.slice(0, 200),
    description: (event.summary || event.title).slice(0, 5000),
    datetime: new Date(event.startsAt),
    endDatetime: event.endsAt ? new Date(event.endsAt) : null,
    ...location,
    orgId: event.host ? (ctx.orgByExternal.get(event.host.id) ?? null) : null,
    creatorId: ctx.botId,
    flyerUrl: event.imageUrl ?? null,
    externalLink: event.rsvpUrl ?? null,
    sourceUrl: event.source.url ?? null,
    isPublic: true,
    status: "published" as const,
    source: event.source.kind,
    announcementCount: event.announcements.emails,
    announcedAt: event.announcements.firstAnnouncedAt
      ? new Date(event.announcements.firstAnnouncedAt)
      : null,
    // Keep the source timestamp so a local location re-resolution cannot make
    // a later InboxEngine update appear stale.
    updatedAt: new Date(event.updatedAt),
  };
}
