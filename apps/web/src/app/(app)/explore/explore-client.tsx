"use client";

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
import { EventList } from "~/components/events/event-list";
import { MiniEventList } from "~/components/events/mini-event-list";
import { PageShell, SectionHeading } from "~/components/layout/page-shell";
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
    () => (savedEvents.length > 0 ? savedEvents : events).slice(0, 5),
    [savedEvents, events],
  );

  const describeWhen = (event: FeedEvent) =>
    event.rawDatetime
      ? `${formatRelativeDay(new Date(event.rawDatetime)).replace(/^on /, "")} · ${event.location}`
      : `${event.datetime} · ${event.location}`;

  /*
   * Search-first and dense: search + topic chips, then one list of event rows.
   * The side panels sit beside the list from `lg` and below it on smaller
   * screens, so friends' plans and saved events are reachable on phones too.
   */
  return (
    <PageShell>
      <h1 className="sr-only">Explore events</h1>
      <div className="mb-3 flex flex-col gap-2.5">
        <SearchInput
          label="Search events"
          shortcut
          placeholder="Search events, places, organizations…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <EventFilters activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section aria-label="Events" className="min-w-0">
          <p className="mb-2 font-dm-sans text-[12px] text-forum-light-gray">
            {searchQuery.trim() || activeFilters.length > 0
              ? loadError
                ? "Search failed"
                : isPending
                  ? "Searching…"
                  : `${total} ${total === 1 ? "event matches" : "events match"}`
              : `Upcoming · ${getTodayString()}`}
          </p>

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
            <EventList className={isPending ? "opacity-60 transition-opacity" : undefined}>
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  {...event}
                  density="row"
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
            </EventList>
          )}
        </section>

        <aside aria-label="Highlights" className="flex flex-col gap-6 lg:pt-6">
          <section>
            <SectionHeading>Friends going</SectionHeading>
            <MiniEventList
              empty="None of your friends have RSVP'd to an event yet."
              items={friendsEvents.slice(0, 5).map((event) => {
                const friend = event.friendsAttending[0];
                const others = event.friendsAttending.length - 1;
                return {
                  id: event.id,
                  title: event.title,
                  eyebrow: `${friend?.displayName.split(" ")[0] ?? "A friend"}${
                    others > 0 ? ` + ${others}` : ""
                  } going`,
                  meta: describeWhen(event),
                };
              })}
            />
            <Link
              href="/friends"
              className="mt-2 inline-block font-dm-sans text-[12px] font-medium text-forum-cerulean hover:underline"
            >
              Friends →
            </Link>
          </section>

          <section>
            <SectionHeading>{savedEvents.length > 0 ? "Saved" : "Coming up"}</SectionHeading>
            <MiniEventList
              empty="No upcoming events yet."
              items={upcomingList.map((event) => ({
                id: event.id,
                title: event.title,
                meta: describeWhen(event),
              }))}
            />
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
