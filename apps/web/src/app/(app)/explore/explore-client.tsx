"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type FeedEvent,
  type FriendsEvent,
  getFeedEvents,
  toggleRsvp,
  toggleSave,
} from "~/actions/events";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState, ErrorState, EventCardSkeletonList } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { EventFilters } from "~/components/events/event-filters";
import { PageHeading, PageShell, SectionHeading } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { buildGCalUrl } from "~/lib/calendar";
import { formatLongDate, formatRelativeDay } from "~/lib/date-format";

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
  return formatLongDate(new Date());
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
  /*
   * The full match count, not the page size. `getFeedEvents` pages at 20 while
   * returning a separate count over every match, so reporting `events.length`
   * capped the message at "20 events match" no matter how many there were.
   */
  const [total, setTotal] = useState(initialTotal);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  /*
   * Hidden events stay in the list as collapsed stubs rather than being
   * filtered out, so hiding stays reversible without a reload.
   */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();
  /** Set when a feed fetch fails, so the list can offer a retry. */
  const [loadError, setLoadError] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  /*
   * Monotonic id for feed requests. Only the most recently issued one may write
   * to state: two fetches can be in flight at once (type, then toggle a filter),
   * and without this the slower-but-older response lands last and wins.
   */
  const latestRequest = useRef(0);
  const firstName = useMemo(() => userName.split(" ")[0] || "there", [userName]);

  /** Drop a queued debounced search — it carries whatever filters were active when it was armed. */
  const cancelPendingSearch = useCallback(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }
  }, []);

  const refreshEvents = useCallback((filters: string[], search: string) => {
    const requestId = ++latestRequest.current;
    startTransition(async () => {
      try {
        const result = await getFeedEvents({
          tags: filters.length > 0 ? filters : undefined,
          search: search || undefined,
        });
        if (requestId !== latestRequest.current) return;
        setEvents(result.events);
        setTotal(result.total);
        setLoadError(false);
      } catch {
        if (requestId !== latestRequest.current) return;
        // Surfaced as an ErrorState with a retry rather than an empty feed,
        // which reads as "no events" and is a very different thing.
        setLoadError(true);
      }
    });
  }, []);

  // A queued search outliving the component would fetch for a dead screen.
  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const handleFilterToggle = useCallback(
    (filterId: string) => {
      const next = activeFilters.includes(filterId)
        ? activeFilters.filter((f) => f !== filterId)
        : [...activeFilters, filterId];
      setActiveFilters(next);
      /*
       * Cancel first. A search queued moments ago captured the *previous*
       * filters, so letting it fire would re-fetch without the chip the user
       * just clicked and overwrite this result — the feed and the active
       * filters would disagree until the next interaction. The fetch below
       * already carries the current query, so nothing is lost by dropping it.
       */
      cancelPendingSearch();
      refreshEvents(next, searchQuery.trim());
    },
    [activeFilters, searchQuery, refreshEvents, cancelPendingSearch],
  );

  /*
   * Debounced as you type, matching Orgs. Explore used to require Enter, so
   * the two search fields behaved differently for no reason.
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        refreshEvents(activeFilters, value.trim());
      }, 300);
    },
    [activeFilters, refreshEvents],
  );

  /*
   * Flip the card first so the bookmark reacts on click, then reconcile with
   * whatever the server actually stored. Without the leading flip there was
   * nothing to roll back, and the `catch` inverted a value that was still
   * correct — leaving the UI disagreeing with the database.
   *
   * Rethrown so the card knows not to announce success; the error toast here
   * is the only feedback the failure gets.
   */
  const handleSaveToggle = useCallback(async (eventId: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, isSaved: !e.isSaved } : e)));
    try {
      const result = await toggleSave(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, isSaved: result.saved } : e)),
      );
    } catch (error) {
      toast.error("Couldn't update saved events. Please try again.");
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, isSaved: !e.isSaved } : e)));
      throw error;
    }
  }, []);

  /*
   * Same optimistic-then-reconcile shape as `handleSaveToggle`, plus the count
   * and the roster. The card renders an avatar stack from `attendees` next to
   * that count, so reconciling the number alone left the viewer's own face in
   * the stack (and in the attendees dialog) after they un-RSVP'd.
   */
  const handleRsvpToggle = useCallback(async (eventId: string) => {
    const flip = (e: FeedEvent) => ({
      ...e,
      isRsvped: !e.isRsvped,
      rsvpCount: Math.max(0, e.rsvpCount + (e.isRsvped ? -1 : 1)),
    });

    setEvents((prev) => prev.map((e) => (e.id === eventId ? flip(e) : e)));
    try {
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
    } catch (error) {
      toast.error("Couldn't update your RSVP. Please try again.");
      setEvents((prev) => prev.map((e) => (e.id === eventId ? flip(e) : e)));
      throw error;
    }
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
   *
   * The shell runs full width rather than `wide` (max-w-7xl) so the row's right
   * edge is the content area's right edge. That is what keeps the highlights
   * rail still while the nav rail expands: only the shell's *left* edge moves,
   * so the greeting, search field and cards slide right and the feed narrows,
   * while the rail — pinned to the right by `ml-auto` — does not budge. With a
   * capped shell the whole row re-centred and the rail travelled with it.
   */
  return (
    <PageShell width="full" className="flex flex-col gap-8 xl:h-full xl:flex-row">
      {/* CENTER — Feed. Capped so cards stay card-sized on very wide displays. */}
      <div className="flex min-w-0 max-w-[1000px] flex-1 flex-col gap-5 xl:overflow-y-auto">
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
          <span className="font-normal">Hello </span>
          <span className="font-bold italic">{firstName},</span>
        </PageHeading>

        <SearchInput
          label="Search events"
          placeholder="Search for events"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <EventFilters activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />

        {/* Result count, so a filtered feed says how filtered it is */}
        {(searchQuery.trim() || activeFilters.length > 0) && !loadError && (
          <p className="font-dm-sans text-[12px] text-forum-light-gray">
            {isPending
              ? "Searching…"
              : `${total} ${total === 1 ? "event matches" : "events match"}`}
          </p>
        )}

        {/* Feed */}
        <div className="flex flex-col gap-5">
          {loadError ? (
            <ErrorState
              title="Couldn't load events"
              description="Something went wrong fetching the feed."
              onRetry={() => {
                cancelPendingSearch();
                refreshEvents(activeFilters, searchQuery.trim());
              }}
            />
          ) : isPending && events.length === 0 ? (
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
            /*
             * Two columns from `sm` up. Cards stretch to the row height so a
             * short description doesn't leave its neighbour's RSVP row floating
             * at a different height.
             */
            <div className="grid gap-5 sm:grid-cols-2">
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  {...event}
                  className="h-full"
                  calendarUrl={
                    event.rawDatetime
                      ? buildGCalUrl({
                          title: event.title,
                          description: event.description,
                          datetime: new Date(event.rawDatetime),
                          endDatetime: null,
                          locationName: event.location,
                        })
                      : undefined
                  }
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
              ))}
            </div>
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
        className="hidden w-[320px] shrink-0 flex-col gap-8 overflow-y-auto xl:ml-auto xl:flex xl:pt-[60px]"
      >
        {/* Find My Friends */}
        <section>
          <SectionHeading>Find My Friends</SectionHeading>
          {friendsEvents.length === 0 ? (
            <p className="font-dm-sans text-[13px] text-forum-light-gray">
              None of your friends have RSVP'd to an event yet.
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
                        is going to{" "}
                        <span className="font-bold text-forum-cerulean">{event.title}</span>.
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
