"use client";

import { MapPin, X } from "lucide-react";
import type { MapEvent } from "~/actions/map";
import { EmptyState } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface EventListPanelProps {
  /** Only the events at the clicked pin, not the whole filtered set. */
  events: MapEvent[];
  /** Name of the clicked location, shown in the header. */
  locationName: string;
  /**
   * The event whose detail card is currently open — the only card that gets
   * the highlighted fill.
   *
   * This used to be the selected *location*, which meant clicking a pin holding
   * four events highlighted all four cards at once.
   */
  expandedEventId: string | null;
  onLocateEvent: (event: MapEvent) => void;
  onExpandEvent: (eventId: string) => void;
  onClose: () => void;
}

/**
 * The map's right-hand event list.
 *
 * Rendered as separate floating cards over the map rather than one opaque
 * full-height panel, matching the design — the map stays visible in the gaps
 * between cards.
 */
export function EventListPanel({
  events,
  locationName,
  expandedEventId,
  onLocateEvent,
  onExpandEvent,
  onClose,
}: EventListPanelProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2.5 overflow-y-auto overscroll-contain py-3 pl-3 pr-2 scrollbar-cerulean">
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl bg-white px-3 py-1.5 shadow-md">
        <div className="min-w-0">
          <p className="truncate font-dm-sans text-[13px] font-semibold text-black">
            {locationName || "Events"}
          </p>
          <p className="font-dm-sans text-[11px] text-forum-light-gray">
            {events.length} event{events.length !== 1 ? "s" : ""} here
          </p>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="Close event list" onClick={onClose}>
          <X />
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl bg-white shadow-md">
          <EmptyState
            icon={MapPin}
            title="No events found"
            description="Try adjusting your filters."
          />
        </div>
      ) : (
        events.map((event, index) => (
          <EventCard
            key={event.id}
            id={event.id}
            title={event.title}
            orgName={event.orgName}
            datetime={new Date(event.rawDatetime).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            location={event.locationName}
            tags={event.tags}
            friendsAttending={event.friendsAttending}
            density="compact"
            source="map"
            position={index}
            onLocate={() => onLocateEvent(event)}
            onOpen={() => onExpandEvent(event.id)}
            className={cn(
              "shrink-0 border-0 shadow-md transition-colors",
              // Tinted only while this card's own detail view is open.
              expandedEventId === event.id ? "bg-[#ECFCFC]" : "bg-white",
            )}
          />
        ))
      )}
    </div>
  );
}
