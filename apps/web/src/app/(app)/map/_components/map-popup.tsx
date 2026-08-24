import { Maximize2 } from "lucide-react";
import type { MapEvent } from "~/actions/map";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { URGENCY_STYLES, getEventColor, getRelativeLabel } from "../_lib/map-helpers";

interface MapPopupProps {
  event: MapEvent;
  onExpand: () => void;
}

export function MapPopup({ event, onExpand }: MapPopupProps) {
  const color = getEventColor(event.tags);
  const rel = getRelativeLabel(event.rawDatetime);
  const urgency = URGENCY_STYLES[rel.urgency];
  const eventDate = new Date(event.rawDatetime);

  return (
    <div className="p-3 min-w-[240px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-black leading-tight">{event.title}</h3>
          <p className="text-xs text-forum-dark-gray mt-1">
            {eventDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-xs text-forum-dark-gray">
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
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open event details"
          onClick={onExpand}
          className="shrink-0"
        >
          <Maximize2 />
        </Button>
      </div>

      {event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.tags.slice(0, 3).map((tag) => {
            const tagColor = getEventColor([tag]);
            return (
              <span
                key={tag}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: tagColor.bg, color: tagColor.text }}
              >
                {tag.replace(/-/g, " ")}
              </span>
            );
          })}
        </div>
      )}

      {event.orgName && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-forum-medium-gray">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color.dot }} />
          <span className="text-[11px] text-forum-dark-gray truncate">{event.orgName}</span>
        </div>
      )}
    </div>
  );
}
