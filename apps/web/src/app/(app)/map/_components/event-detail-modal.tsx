"use client";

import { Bookmark, MapPin, Share2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { getEvent } from "~/actions/events";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { getEventColor } from "../_lib/map-helpers";

interface EventDetailModalProps {
  eventId: string | null;
  onClose: () => void;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  datetime: Date;
  endDatetime: Date | null;
  locationName: string | null;
  orgName: string | null;
  flyerUrl: string | null;
  tags: string[];
  rsvpCount: number;
  isRsvped: boolean;
  isSaved: boolean;
}

export function EventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      return;
    }
    startTransition(async () => {
      const result = await getEvent(eventId);
      if (result) {
        setEvent(result as unknown as EventDetail);
      }
    });
  }, [eventId]);

  return (
    <Dialog open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">{event?.title ?? "Event Details"}</DialogTitle>

        {isPending || !event ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-forum-border border-t-sky-500 animate-spin" />
              <span className="text-xs text-forum-light-gray">Loading event</span>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Header with actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {event.orgName && (
                  <p className="text-xs font-medium text-forum-dark-gray mb-1">{event.orgName}</p>
                )}
                <h2 className="text-2xl font-bold text-black leading-tight">{event.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" aria-label="Save event">
                  <Bookmark />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Share event">
                  <Share2 />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
                  <X />
                </Button>
              </div>
            </div>

            {/* Location + time */}
            <div className="flex items-center gap-4 mt-3 text-sm text-forum-dark-gray">
              {event.locationName && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-forum-light-gray" />
                  {event.locationName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-forum-light-gray" />
                {new Date(event.datetime).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                at{" "}
                {new Date(event.datetime).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {event.tags.map((tag) => {
                  const tagColor = getEventColor([tag]);
                  return (
                    <span
                      key={tag}
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: tagColor.bg, color: tagColor.text }}
                    >
                      {tag.replace(/-/g, " ")}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Description */}
            {event.description && (
              <p className="mt-4 text-sm text-forum-dark-gray leading-relaxed">
                {event.description}
              </p>
            )}

            {/* RSVP button */}
            <Button variant="cerulean" size="cta" className="mt-6 w-full">
              RSVP now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
