"use client";

import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { type EventDetail, getEvent, toggleRsvp, toggleSave } from "~/actions/events";
import { EventCard } from "~/components/events/event-card";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "~/components/ui/dialog";

interface EventDetailModalProps {
  eventId: string | null;
  onClose: () => void;
}

/**
 * The map's expanded event view.
 *
 * Renders the same `EventCard` the Explore feed uses, so an event looks
 * identical whether you found it in the feed or on the map. This previously
 * had a bespoke two-column layout, which meant the same event had two
 * different visual treatments depending on where you opened it.
 */
export function EventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [, startMutating] = useTransition();

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      return;
    }
    startLoading(async () => {
      setEvent(await getEvent(eventId));
    });
  }, [eventId]);

  const handleRsvp = () => {
    if (!event) return;
    setEvent({ ...event, isRsvped: !event.isRsvped });
    startMutating(async () => {
      const result = await toggleRsvp(event.id);
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              isRsvped: result.rsvped,
              rsvpCount: result.count,
              attendees: result.attendees,
            }
          : prev,
      );
    });
  };

  const handleSave = () => {
    if (!event) return;
    setEvent({ ...event, isSaved: !event.isSaved });
    startMutating(async () => {
      const result = await toggleSave(event.id);
      setEvent((prev) => (prev ? { ...prev, isSaved: result.saved } : prev));
    });
  };

  const handleShare = async () => {
    if (!event) return;
    await navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`);
    toast.success("Link copied to clipboard");
  };

  return (
    <Dialog open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      {/*
        Transparent overlay and chrome: the card is the surface, floating over a
        still-visible map so you keep track of which pin you opened.
      */}
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-transparent"
        className="max-h-[85vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">{event?.title ?? "Event details"}</DialogTitle>

        <div className="mb-1 flex justify-end">
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              className="bg-white/90 shadow-sm backdrop-blur-sm hover:bg-white"
            >
              <X className="text-forum-dark-gray" />
            </Button>
          </DialogClose>
        </div>

        {isLoading || !event ? (
          <output className="flex items-center justify-center rounded-xl bg-white py-20 shadow-2xl">
            <span className="flex flex-col items-center gap-2">
              <span className="size-6 animate-spin rounded-full border-2 border-forum-border border-t-forum-cerulean" />
              <span className="font-dm-sans text-xs text-forum-light-gray">Loading event</span>
            </span>
          </output>
        ) : (
          <EventCard
            id={event.id}
            title={event.title}
            orgId={event.orgId}
            orgName={event.orgName}
            datetime={`${event.datetime.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })} · ${event.datetime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}`}
            location={event.locationName}
            description={event.description}
            tags={event.tags}
            rsvpCount={event.rsvpCount}
            attendees={event.attendees}
            friendsAttending={event.friendsAttending}
            isSaved={event.isSaved}
            isRsvped={event.isRsvped}
            onSaveToggle={handleSave}
            onRsvpToggle={handleRsvp}
            onShare={handleShare}
            source="map"
            className="shadow-2xl"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
