"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type FeedEvent,
  type FriendsEvent,
  getFeedEvents,
  toggleRsvp,
  toggleSave,
} from "~/actions/events";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState, EventCardSkeletonList } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { EventFilters } from "~/components/events/event-filters";
import { PageHeading, PageShell, SectionHeading } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { formatRelativeDay } from "~/lib/date-format";

interface ExploreClientProps {
  initialEvents: FeedEvent[];
  initialTotal: number;
  savedEvents: FeedEvent[];
  friendsEvents: FriendsEvent[];
  initialSearch?: string;
  userName?: string;
  userAvatarUrl?: string | null;
}

function getTodayString() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ExploreClient({
  initialEvents,
  initialTotal,
  savedEvents,
  friendsEvents,
  initialSearch = "",
  userName = "there",
  userAvatarUrl,
}: ExploreClientProps) {
  /*
   * Straight from the server, with no demo-event fallback. Substituting a fake
   * event when the feed came back empty meant the empty state could never
   * render on first load, which is precisely the case this screen has to handle.
   */
  const [events, setEvents] = useState(initialEvents);
  const [_total, setTotal] = useState(initialTotal);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  /*
   * Hidden events stay in the list as collapsed stubs rather than being
   * filtered out, so hiding stays reversible without a reload.
   */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();
  const firstName = useMemo(() => userName.split(" ")[0] || "there", [userName]);

  const refreshEvents = useCallback((filters: string[], search: string) => {
    startTransition(async () => {
      const result = await getFeedEvents({
        tags: filters.length > 0 ? filters : undefined,
        search: search || undefined,
      });
      setEvents(result.events);
      setTotal(result.total);
    });
  }, []);

  const handleFilterToggle = useCallback(
    (filterId: string) => {
      const next = activeFilters.includes(filterId)
        ? activeFilters.filter((f) => f !== filterId)
        : [...activeFilters, filterId];
      setActiveFilters(next);
      refreshEvents(next, searchQuery);
    },
    [activeFilters, searchQuery, refreshEvents],
  );

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) refreshEvents(activeFilters, searchQuery.trim());
  }, [searchQuery, activeFilters, refreshEvents]);

  const handleSaveToggle = useCallback(async (eventId: string) => {
    const result = await toggleSave(eventId);
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, isSaved: result.saved } : e)));
  }, []);

  /*
   * `attendees` is taken from the response too, not just the count: the card
   * renders both, so patching the number alone left the viewer's own avatar in
   * the stack (and in the attendees dialog) after they un-RSVP'd.
   */
  const handleRsvpToggle = useCallback(async (eventId: string) => {
    const result = await toggleRsvp(eventId);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              isRsvped: result.rsvped,
              rsvpCount: result.count,
              attendees: result.attendees,
            }
          : e,
      ),
    );
  }, []);

  const upcomingList = useMemo(
    () => (savedEvents.length > 0 ? savedEvents : events).slice(0, 3),
    [savedEvents, events],
  );

  /*
   * Single column that scrolls with the page on phones; the two-column layout
   * with its own internal scroll only kicks in at xl, where the right rail
   * appears. Nesting a scroll container inside the page scroller on a phone
   * made the feed feel stuck.
   */
  return (
    <PageShell width="wide" className="flex flex-col gap-8 xl:h-full xl:flex-row">
      {/* CENTER — Feed */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 xl:overflow-y-auto">
        <PageHeading
          description={
            <>
              <span
                aria-hidden
                className="mr-2 inline-block size-[10px] rounded-full bg-forum-coral align-middle"
              />
              <span className="font-serif text-[16px] italic text-black">
                Today is {getTodayString()}
              </span>
            </>
          }
        >
          <span className="font-normal">Hi </span>
          <span className="font-bold italic">{firstName},</span>
        </PageHeading>

        <SearchInput
          label="Search events"
          placeholder="Search for events"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />

        <EventFilters activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />

        {/* Feed */}
        <div className="flex flex-col gap-5">
          {isPending && events.length === 0 ? (
            <EventCardSkeletonList />
          ) : events.length === 0 ? (
            <EmptyState
              title="No events found"
              description={
                activeFilters.length > 0 || searchQuery
                  ? "Try adjusting your filters or search."
                  : "Events will appear here once they're created."
              }
            />
          ) : (
            events.map((event, index) => (
              <EventCard
                key={event.id}
                {...event}
                source="feed"
                position={index}
                onSaveToggle={() => handleSaveToggle(event.id)}
                onRsvpToggle={() => handleRsvpToggle(event.id)}
                onShare={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`);
                  toast.success("Link copied to clipboard");
                }}
                isHidden={hiddenIds.has(event.id)}
                onHide={() => {
                  setHiddenIds((prev) => new Set(prev).add(event.id));
                }}
                onUnhide={() => {
                  setHiddenIds((prev) => {
                    const next = new Set(prev);
                    next.delete(event.id);
                    return next;
                  });
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      {/*
        Nudged down so "Find My Friends" starts level with the "Today is…" line
        rather than the greeting above it: the h1 is 52px at this breakpoint
        plus the 8px gap to its description.
      */}
      <aside
        aria-label="Highlights"
        className="hidden w-[320px] shrink-0 flex-col gap-8 overflow-y-auto xl:flex xl:pt-[60px]"
      >
        {/* Find My Friends */}
        <section>
          <SectionHeading>Find My Friends</SectionHeading>
          {friendsEvents.length === 0 ? (
            <p className="font-dm-sans text-[13px] text-forum-light-gray">
              None of your friends have added an event yet.
            </p>
          ) : (
            /* Hairline dividers instead of gaps — keeps a longer list calm. */
            <ul className="divide-y divide-forum-medium-gray">
              {friendsEvents.slice(0, 4).map((event) => {
                const friend = event.friendsAttending[0];
                return (
                  <li key={event.id} className="flex items-center gap-3 py-3 first:pt-1">
                    {friend?.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full object-cover ring-2 ring-forum-medium-gray"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forum-cerulean font-dm-sans text-[14px] font-bold text-white ring-2 ring-forum-medium-gray"
                      >
                        {friend?.displayName[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-dm-sans text-[13px] leading-snug text-black line-clamp-2">
                        <span className="font-bold text-forum-cerulean">
                          {friend?.displayName.split(" ")[0] ?? "A friend"}
                        </span>{" "}
                        added <span className="font-bold text-forum-cerulean">{event.title}</span>{" "}
                        to their calendar.
                      </p>
                      <p className="mt-1 truncate font-dm-sans text-[11px] text-forum-light-gray">
                        {event.location} @ {event.datetime}
                      </p>
                    </div>

                    <Button
                      asChild
                      variant="coral"
                      size="xs"
                      className="shrink-0 rounded-full px-3 text-[10px] font-bold tracking-wide"
                    >
                      <Link href={`/events/${event.id}`}>VIEW EVENT</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-4 w-full rounded-full text-[10px] font-bold tracking-wide text-forum-dark-gray"
          >
            <Link href="/friends">
              VIEW ALL FRIENDS
              <ExternalLink />
            </Link>
          </Button>
        </section>

        {/* Upcoming Events */}
        <section>
          <SectionHeading>Upcoming Events</SectionHeading>
          {upcomingList.length === 0 ? (
            <p className="font-dm-sans text-[13px] text-forum-light-gray">
              No upcoming events yet.
            </p>
          ) : (
            <ul className="divide-y divide-forum-medium-gray">
              {upcomingList.map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-3 first:pt-1">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-forum-turquoise/40">
                    {event.flyerUrl && (
                      <img src={event.flyerUrl} alt="" className="size-full object-cover" />
                    )}
                  </div>

                  <p className="min-w-0 flex-1 font-dm-sans text-[13px] leading-snug text-black line-clamp-2">
                    <span className="font-bold">{event.title}</span> is happening{" "}
                    {event.rawDatetime ? formatRelativeDay(new Date(event.rawDatetime)) : "soon"}!
                  </p>

                  <Button
                    asChild
                    variant="outline"
                    size="xs"
                    className="shrink-0 rounded-full px-3 text-[10px] font-bold tracking-wide text-forum-dark-gray"
                  >
                    <Link href={`/events/${event.id}`}>DETAILS</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </PageShell>
  );
}
