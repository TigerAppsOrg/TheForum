"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { EventCollection, EventViewToggle } from "~/components/events/event-collection";
import { EventFilters } from "~/components/events/event-filters";
import { MiniEventList } from "~/components/events/mini-event-list";
import { Greeting } from "~/components/layout/greeting";
import { PageShell, SectionHeading } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { buildGCalUrl } from "~/lib/calendar";
import { formatRelativeDay } from "~/lib/date-format";
import { useEventView } from "~/lib/use-event-view";

interface ExploreClientProps {
  initialEvents: FeedEvent[];
  initialTotal: number;
  /** The instant the first page was ranked at — echoed back so later pages slice the same ranking. */
  initialAsOf: string;
  savedEvents: FeedEvent[];
  friendsEvents: FriendsEvent[];
  initialSearch?: string;
  userName?: string;
  userAvatarUrl?: string | null;
}

export function ExploreClient({
  initialEvents,
  initialTotal,
  initialAsOf,
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
  /*
   * Pagination. `nextOffset` counts rows the server has handed us (not
   * `events.length`, which is after de-duplication), and `asOf` pins later
   * pages to the ranking page 1 came from.
   */
  const [nextOffset, setNextOffset] = useState(initialEvents.length);
  const [asOf, setAsOf] = useState(initialAsOf);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  /*
   * Hidden events stay in the list as collapsed stubs rather than being
   * filtered out, so hiding stays reversible without a reload.
   */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [view, setView] = useEventView("cards");
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
  /** Filters + search the current list was fetched with; "Load more" must reuse them. */
  const currentQuery = useRef<{ filters: string[]; search: string }>({
    filters: [],
    search: initialSearch.trim(),
  });

  /** Drop a queued debounced search — it carries whatever filters were active when it was armed. */
  const cancelPendingSearch = useCallback(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }
  }, []);

  const refreshEvents = useCallback((filters: string[], search: string) => {
    const requestId = ++latestRequest.current;
    currentQuery.current = { filters, search };
    setIsLoadingMore(false);
    startTransition(async () => {
      try {
        const result = await getFeedEvents({
          tags: filters.length > 0 ? filters : undefined,
          search: search || undefined,
        });
        if (requestId !== latestRequest.current) return;
        setEvents(result.events);
        setTotal(result.total);
        setNextOffset(result.events.length);
        setAsOf(result.asOf);
        setLoadError(false);
      } catch {
        if (requestId !== latestRequest.current) return;
        // Surfaced as an ErrorState with a retry rather than an empty feed,
        // which reads as "no events" and is a very different thing.
        setLoadError(true);
      }
    });
  }, []);

  /*
   * Append the next page. Shares `latestRequest` with `refreshEvents`, so a
   * filter or search change while this is in flight discards the stale page.
   * Rows already on screen are skipped in case the ranking shifted between
   * requests (e.g. a friend RSVP'd in the meantime).
   */
  const loadMore = useCallback(async () => {
    const requestId = latestRequest.current;
    const { filters, search } = currentQuery.current;
    setIsLoadingMore(true);
    try {
      const result = await getFeedEvents({
        tags: filters.length > 0 ? filters : undefined,
        search: search || undefined,
        offset: nextOffset,
        asOf,
      });
      if (requestId !== latestRequest.current) return;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...result.events.filter((e) => !seen.has(e.id))];
      });
      setTotal(result.total);
      setNextOffset(nextOffset + result.events.length);
      setAsOf(result.asOf);
    } catch {
      if (requestId !== latestRequest.current) return;
      toast.error("Couldn't load more events. Please try again.");
    } finally {
      if (requestId === latestRequest.current) setIsLoadingMore(false);
    }
  }, [nextOffset, asOf]);

  const hasMore = nextOffset < total;

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

  const describeWhen = (event: FeedEvent) =>
    event.rawDatetime
      ? `${formatRelativeDay(new Date(event.rawDatetime)).replace(/^on /, "")} · ${event.location}`
      : `${event.datetime} · ${event.location}`;

  const filtered = Boolean(searchQuery.trim() || activeFilters.length > 0);

  /*
   * Figma Home: greeting, pill search, topic chips, then the feed as cards
   * (two columns on wide screens) or compact rows — the reader's choice,
   * remembered. The side column holds friends' plans and saved events; it sits
   * beside the feed from `xl` and below it on smaller screens.
   */
  return (
    <PageShell>
      <Greeting name={userName} />

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput
          label="Search events"
          shortcut
          placeholder="Search for events, places or organizations"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <EventFilters activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
        <section aria-label="Events" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-dm-sans text-[12px] text-forum-light-gray">
              {filtered
                ? loadError
                  ? "Search failed"
                  : isPending
                    ? "Searching…"
                    : `${total} ${total === 1 ? "event matches" : "events match"}`
                : `${total} upcoming ${total === 1 ? "event" : "events"}`}
            </p>
            <EventViewToggle view={view} onChange={setView} />
          </div>

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
                filtered
                  ? "Try adjusting your filters or search."
                  : "Events will appear here once they're created."
              }
            />
          ) : (
            <EventCollection
              items={events}
              view={view}
              className={isPending ? "opacity-60 transition-opacity" : undefined}
              renderItem={(event, index, density) => (
                <EventCard
                  key={event.id}
                  {...event}
                  density={density}
                  className={density === "default" ? "h-full" : undefined}
                  calendarUrl={
                    density === "default" && event.rawDatetime
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
              )}
            />
          )}

          {hasMore && !loadError && events.length > 0 && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-white px-5"
                onClick={loadMore}
                disabled={isLoadingMore || isPending}
              >
                {isLoadingMore ? "Loading…" : `Load more (${total - nextOffset} left)`}
              </Button>
            </div>
          )}
        </section>

        <aside aria-label="Highlights" className="flex flex-col gap-6 xl:pt-10">
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
              Find friends →
            </Link>
          </section>

          {/* Only saved events — "coming up" just repeated the top of the feed. */}
          {savedEvents.length > 0 && (
            <section>
              <SectionHeading>Saved</SectionHeading>
              <MiniEventList
                empty=""
                items={savedEvents.slice(0, 5).map((event) => ({
                  id: event.id,
                  title: event.title,
                  meta: describeWhen(event),
                }))}
              />
              <Link
                href="/events"
                className="mt-2 inline-block font-dm-sans text-[12px] font-medium text-forum-cerulean hover:underline"
              >
                My Events →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
