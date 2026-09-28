"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type FeedEvent, deleteEvent, toggleRsvp, toggleSave } from "~/actions/events";
import { CalendarView } from "~/components/calendar/calendar-view";
import { EmptyState } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { EventCollection, EventViewToggle } from "~/components/events/event-collection";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useEventView } from "~/lib/use-event-view";

const TABS = [
  {
    id: "rsvped",
    label: "Going",
    emptyTitle: "Nothing on your calendar yet",
    emptyBody: "Events you RSVP to show up here.",
  },
  {
    id: "saved",
    label: "Saved",
    emptyTitle: "No saved events",
    emptyBody: "Bookmark events you might go to.",
  },
  {
    id: "created",
    label: "Hosting",
    emptyTitle: "You haven't posted any events",
    emptyBody: "Share something with campus — create your first event.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface MyEventsClientProps {
  created: FeedEvent[];
  rsvped: FeedEvent[];
  saved: FeedEvent[];
}

export function MyEventsClient({ created, rsvped, saved }: MyEventsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("rsvped");
  const [view, setView] = useEventView("my-events", "rows");
  const [lists, setLists] = useState<Record<TabId, FeedEvent[]>>({ created, rsvped, saved });

  /**
   * Update one event wherever it appears across the three tabs, and — when
   * `dropFrom` is given — take it out of the tab it no longer belongs to.
   *
   * The tabs *are* the membership: unsaving from Saved or cancelling an RSVP
   * used to flip the button and leave the card sitting in a list it had just
   * been removed from, until a reload.
   */
  const patchEvent = (eventId: string, patch: Partial<FeedEvent>, dropFrom?: TabId) => {
    setLists((prev) => {
      const next = {} as Record<TabId, FeedEvent[]>;
      for (const key of Object.keys(prev) as TabId[]) {
        const list = key === dropFrom ? prev[key].filter((e) => e.id !== eventId) : prev[key];
        next[key] = list.map((e) => (e.id === eventId ? { ...e, ...patch } : e));
      }
      return next;
    });
  };

  const handleSaveToggle = async (eventId: string) => {
    const result = await toggleSave(eventId);
    patchEvent(eventId, { isSaved: result.saved }, result.saved ? undefined : "saved");
  };

  const handleRsvpToggle = async (eventId: string) => {
    const result = await toggleRsvp(eventId);
    patchEvent(
      eventId,
      // Attendees ride along with the count so the avatar stack doesn't keep
      // showing the viewer after they've cancelled.
      { isRsvped: result.rsvped, rsvpCount: result.count, attendees: result.attendees },
      result.rsvped ? undefined : "rsvped",
    );
  };

  /*
   * Deleting is irreversible, so it goes through a confirmation rather than
   * firing straight off the card.
   */
  const [pendingDelete, setPendingDelete] = useState<FeedEvent | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id, title } = pendingDelete;
    startDeleting(async () => {
      try {
        await deleteEvent(id);
      } catch {
        toast.error("Couldn't delete the event. Please try again.");
        return;
      }
      setLists((prev) => ({
        created: prev.created.filter((e) => e.id !== id),
        rsvped: prev.rsvped.filter((e) => e.id !== id),
        saved: prev.saved.filter((e) => e.id !== id),
      }));
      setPendingDelete(null);
      toast.success(`Deleted ${title}`);
    });
  };

  const eventMap = lists;

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
      <div className="flex items-end justify-between gap-3 border-b border-forum-border">
        {view === "calendar" ? (
          <p className="py-2 font-dm-sans text-[13px] text-forum-dark-gray">
            Going, Saved and the organizations you follow
          </p>
        ) : (
          <TabsList variant="line" className="h-auto justify-start gap-4">
            {TABS.map(({ id, label }) => (
              <TabsTrigger
                key={id}
                value={id}
                // Type scales down on phones so three tabs fit without clipping.
                className="flex-none px-0.5 py-2 font-dm-sans text-[13px] font-semibold text-forum-light-gray after:bottom-[-1px] after:h-0.5 after:bg-forum-cerulean data-[state=active]:text-black"
              >
                {label}
                <span className="ml-1 font-normal text-forum-light-gray">
                  {eventMap[id].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <EventViewToggle view={view} onChange={setView} withCalendar className="mb-1.5" />
      </div>

      {view === "calendar" ? (
        <div className="mt-4">
          <CalendarView />
        </div>
      ) : (
        TABS.map(({ id, emptyTitle, emptyBody }) => (
          <TabsContent key={id} value={id} className="mt-3">
            {eventMap[id].length > 0 ? (
              <EventCollection
                items={eventMap[id]}
                view={view}
                renderItem={(event, index, density) => (
                  <EventCard
                    key={event.id}
                    {...event}
                    density={density}
                    className={density === "default" ? "h-full" : undefined}
                    {...(id === "created"
                      ? {
                          editHref: `/events/${event.id}/edit`,
                          onDelete: () => setPendingDelete(event),
                        }
                      : {})}
                    onSaveToggle={() => handleSaveToggle(event.id)}
                    onRsvpToggle={() => handleRsvpToggle(event.id)}
                    onShare={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`);
                      toast.success("Link copied to clipboard");
                    }}
                    source="feed"
                    position={index}
                  />
                )}
              />
            ) : (
              <EmptyState title={emptyTitle} description={emptyBody} />
            )}
          </TabsContent>
        ))
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{pendingDelete?.title}&rdquo;. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="coral" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
