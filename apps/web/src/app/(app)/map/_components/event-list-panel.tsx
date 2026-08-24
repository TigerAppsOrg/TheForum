"use client";

import { MapPin, Maximize2, X } from "lucide-react";
import type { MapEvent } from "~/actions/map";
import { EmptyState } from "~/components/common/states";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { getEventColor } from "../_lib/map-helpers";

interface EventListPanelProps {
  events: MapEvent[];
  selectedLocation: string | null;
  onLocateEvent: (event: MapEvent) => void;
  onExpandEvent: (eventId: string) => void;
  onClose: () => void;
}

export function EventListPanel({
  events,
  selectedLocation,
  onLocateEvent,
  onExpandEvent,
  onClose,
}: EventListPanelProps) {
  return (
    <div className="flex flex-col h-full w-[380px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-forum-medium-gray px-4 py-3">
        <span className="font-dm-sans text-sm font-semibold text-black">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Close event list" onClick={onClose}>
          <X />
        </Button>
      </div>

      {/* Event cards */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {events.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No events found"
            description="Try adjusting your filters."
          />
        )}

        {events.map((event) => (
          <PanelEventCard
            key={event.id}
            event={event}
            isActive={selectedLocation === event.locationId}
            onLocate={() => onLocateEvent(event)}
            onExpand={() => onExpandEvent(event.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PanelEventCard({
  event,
  isActive,
  onLocate,
  onExpand,
}: {
  event: MapEvent;
  isActive: boolean;
  onLocate: () => void;
  onExpand: () => void;
}) {
  const eventDate = new Date(event.rawDatetime);

  return (
    /*
     * The card was a <button> with a second <button> nested inside it for
     * Expand — invalid HTML, and the inner control was unreachable in some
     * browsers. The two actions are now siblings inside a plain container.
     */
    <div
      className={cn(
        "border-b border-forum-medium-gray px-4 py-3 transition-colors hover:bg-forum-turquoise/10",
        isActive && "border-l-2 border-l-forum-cerulean bg-forum-turquoise/15",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onLocate}
          className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
        >
          <h4 className="truncate font-dm-sans text-sm font-bold leading-tight text-black">
            {event.title}
          </h4>
          <p className="mt-0.5 font-dm-sans text-xs text-forum-dark-gray">
            {eventDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="font-dm-sans text-xs text-forum-dark-gray">
            {eventDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
            {" - "}
            {new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </button>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Open ${event.title}`}
          onClick={onExpand}
          className="shrink-0"
        >
          <Maximize2 />
        </Button>
      </div>

      {/* Tags */}
      {event.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {event.tags.slice(0, 3).map((tag) => {
            const tagColor = getEventColor([tag]);
            return (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 font-dm-sans text-[10px] font-semibold"
                style={{ backgroundColor: tagColor.bg, color: tagColor.text }}
              >
                {tag.replace(/-/g, " ")}
              </span>
            );
          })}
        </div>
      )}

      {/* Org */}
      {event.orgName && (
        <p className="mt-1 truncate font-dm-sans text-[11px] text-forum-light-gray">
          {event.orgName}
        </p>
      )}
    </div>
  );
}
