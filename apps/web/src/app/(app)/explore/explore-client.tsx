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
import { toggleFollowOrg } from "~/actions/orgs";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState, ErrorState, EventCardSkeletonList } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { EventCollection, EventViewToggle } from "~/components/events/event-collection";
import { EventFilters } from "~/components/events/event-filters";
import { FeedSortMenu } from "~/components/events/feed-sort-menu";
import { MiniEventList } from "~/components/events/mini-event-list";
import { Greeting } from "~/components/layout/greeting";
import { PageShell, SectionHeading } from "~/components/layout/page-shell";
import { hideOrgWithUndo } from "~/components/orgs/org-feed-menu";
import { Button } from "~/components/ui/button";
import { buildGCalUrl } from "~/lib/calendar";
import { formatRelativeDay } from "~/lib/date-format";
import { DEFAULT_FEED_SORT, FEED_SORTS, type FeedSort } from "~/lib/feed-ranking";
import { useEventView } from "~/lib/use-event-view";

const SORT_STORAGE_KEY = "forum:feed-sort";

function isFeedSort(value: unknown): value is FeedSort {
  return typeof value === "string" && (FEED_SORTS as readonly string[]).includes(value);
}

interface ExploreClientProps {
  initialEvents: FeedEvent[];
  initialTotal: number;
  /** Offset of the next page, and how many visible events lie beyond it. */
  initialNextOffset: number;
  initialRemaining: number;
  /** The instant the first page was ranked at — echoed back so later pages slice the same ranking. */
  initialAsOf: string;
  initialSort: FeedSort;
  /** `?sort=` was in the URL — it wins over the sort remembered in this browser. */
  sortFromUrl: boolean;
  savedEvents: FeedEvent[];
  friendsEvents: FriendsEvent[];
  initialSearch?: string;
  userName?: string;
  userAvatarUrl?: string | null;
}

export function ExploreClient({
  initialEvents,
  initialTotal,
  initialNextOffset,
  initialRemaining,
  initialAsOf,
  initialSort,
  sortFromUrl,
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
  /** Latest `events`, for callbacks that outlive a render (the hide toast's Undo). */
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  /*
   * The full match count, not the page size. `getFeedEvents` pages at 20 while
   * returning a separate count over every match, so reporting `events.length`
   * capped the message at "20 events match" no matter how many there were.
   */
  const [total, setTotal] = useState(initialTotal);
  /*
   * Pagination. `nextOffset` is the server's position in its ordering (not
   * `events.length`, which is after de-duplication and hidden orgs), and
   * `asOf` pins later pages to the ordering page 1 came from.
   */
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [asOf, setAsOf] = useState(initialAsOf);
  const [sort, setSort] = useState<FeedSort>(initialSort);
  /** Orgs hidden from this screen — their cards drop out at once, Undo brings them back. */
  const [hiddenOrgIds, setHiddenOrgIds] = useState<Set<string>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  /*
   * Hidden events stay in the list as collapsed stubs rather than being
   * filtered out, so hiding stays reversible without a reload.
   */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [view, setView] = useEventView("home", "cards");
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
  /** Filters, search and sort the current list was fetched with; "Load more" must reuse them. */
  const currentQuery = useRef<{ filters: string[]; search: string; sort: FeedSort }>({
    filters: [],
    search: initialSearch.trim(),
    sort: initialSort,
  });

  /** Drop a queued debounced search — it carries whatever filters were active when it was armed. */
  const cancelPendingSearch = useCallback(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }
  }, []);

  const refreshEvents = useCallback((filters: string[], search: string, sort: FeedSort) => {
    const requestId = ++latestRequest.current;
    currentQuery.current = { filters, search, sort };
    setIsLoadingMore(false);
    startTransition(async () => {
      try {
        const result = await getFeedEvents({
          tags: filters.length > 0 ? filters : undefined,
          search: search || undefined,
          sort,
        });
        if (requestId !== latestRequest.current) return;
        setEvents(result.events);
        setTotal(result.total);
        setNextOffset(result.nextOffset);
        setRemaining(result.remaining);
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
    const { filters, search, sort } = currentQuery.current;
    setIsLoadingMore(true);
    try {
      const result = await getFeedEvents({
        tags: filters.length > 0 ? filters : undefined,
        search: search || undefined,
        sort,
        offset: nextOffset,
        asOf,
      });
      if (requestId !== latestRequest.current) return;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...result.events.filter((e) => !seen.has(e.id))];
      });
      setTotal(result.total);
      setNextOffset(result.nextOffset);
      setRemaining(result.remaining);
      setAsOf(result.asOf);
    } catch {
      if (requestId !== latestRequest.current) return;
      toast.error("Couldn't load more events. Please try again.");
    } finally {
      if (requestId === latestRequest.current) setIsLoadingMore(false);
    }
  }, [nextOffset, asOf]);

  const hasMore = remaining > 0;

  /*
   * After hiding (or un-hiding) an org, re-read the counts for the ordering
   * we're paging through — same `asOf` and offset — so "N upcoming events"
   * and "Load more (N left)" stay true. The org's cards are already gone.
   */
  const refreshCounts = useCallback(async () => {
    const requestId = latestRequest.current;
    const { filters, search, sort } = currentQuery.current;
    try {
      const result = await getFeedEvents({
        tags: filters.length > 0 ? filters : undefined,
        search: search || undefined,
        sort,
        offset: nextOffset,
        limit: 1,
        asOf,
      });
      if (requestId !== latestRequest.current) return;
      setTotal(result.total);
      setRemaining(result.remaining + result.events.length);
    } catch {
      // Counts are cosmetic; the next page load corrects them.
    }
  }, [nextOffset, asOf]);

  const visibleEvents = useMemo(
    () =>
      hiddenOrgIds.size === 0
        ? events
        : events.filter((e) => !e.orgId || !hiddenOrgIds.has(e.orgId)),
    [events, hiddenOrgIds],
  );

  const setFollowingOrg = useCallback((orgId: string, following: boolean) => {
    setEvents((prev) =>
      prev.map((e) => (e.orgId === orgId ? { ...e, isFollowingOrg: following } : e)),
    );
  }, []);

  /* Optimistic across every card from the org, then reconciled. */
  const handleToggleFollowOrg = useCallback(
    async (orgId: string, orgName: string, wasFollowing: boolean) => {
      setFollowingOrg(orgId, !wasFollowing);
      try {
        const { following } = await toggleFollowOrg(orgId);
        setFollowingOrg(orgId, following);
        toast(
          following
            ? `Following ${orgName}. Their events will rank higher.`
            : `Unfollowed ${orgName}`,
        );
      } catch {
        setFollowingOrg(orgId, wasFollowing);
        toast.error("Couldn't update that follow. Please try again.");
      }
    },
    [setFollowingOrg],
  );

  const handleHideOrg = useCallback(
    (orgId: string, orgName: string) => {
      const showAgain = () => {
        setHiddenOrgIds((prev) => {
          const next = new Set(prev);
          next.delete(orgId);
          return next;
        });
      };
      void hideOrgWithUndo({
        orgId,
        orgName,
        onHidden: () => {
          setHiddenOrgIds((prev) => new Set(prev).add(orgId));
          setFollowingOrg(orgId, false);
        },
        onSaved: () => void refreshCounts(),
        onRestored: () => {
          showAgain();
          // If the list was re-fetched while hidden, the org's events aren't
          // loaded any more — fetch again rather than leave them missing.
          if (eventsRef.current.some((e) => e.orgId === orgId)) void refreshCounts();
          else {
            const { filters, search, sort } = currentQuery.current;
            refreshEvents(filters, search, sort);
          }
        },
        onFollowRestored: () => setFollowingOrg(orgId, true),
      });
    },
    [refreshCounts, refreshEvents, setFollowingOrg],
  );

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
      refreshEvents(next, searchQuery.trim(), sort);
    },
    [activeFilters, searchQuery, sort, refreshEvents, cancelPendingSearch],
  );

  /*
   * Sort: kept in the URL (`?sort=`, omitted for the default) so it survives
   * reloads and can be shared, and remembered per browser for visits that
   * arrive without one. Storage can be unavailable, so every access is guarded.
   */
  const applySort = useCallback(
    (next: FeedSort, remember: boolean) => {
      setSort(next);
      if (remember) {
        try {
          window.localStorage.setItem(SORT_STORAGE_KEY, next);
        } catch {
          // ignore — the choice just won't persist
        }
      }
      const url = new URL(window.location.href);
      if (next === DEFAULT_FEED_SORT) url.searchParams.delete("sort");
      else url.searchParams.set("sort", next);
      window.history.replaceState(window.history.state, "", url);
      cancelPendingSearch();
      refreshEvents(activeFilters, searchQuery.trim(), next);
    },
    [activeFilters, searchQuery, refreshEvents, cancelPendingSearch],
  );

  // A visit without `?sort=` picks up the sort this browser last used.
  const restoredSort = useRef(false);
  useEffect(() => {
    if (restoredSort.current || sortFromUrl) return;
    restoredSort.current = true;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    } catch {
      return;
    }
    if (isFeedSort(stored) && stored !== initialSort) applySort(stored, false);
  }, [sortFromUrl, initialSort, applySort]);

  /*
   * Debounced as you type, matching Orgs. Explore used to require Enter, so
   * the two search fields behaved differently for no reason.
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        refreshEvents(activeFilters, value.trim(), sort);
      }, 300);
    },
    [activeFilters, sort, refreshEvents],
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
            <div className="flex items-center gap-2">
              <FeedSortMenu sort={sort} onChange={(next) => applySort(next, true)} />
              <EventViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {loadError ? (
            <ErrorState
              title="Couldn't load events"
              description="Something went wrong fetching the feed."
              onRetry={() => {
                cancelPendingSearch();
                refreshEvents(activeFilters, searchQuery.trim(), sort);
              }}
            />
          ) : isPending && visibleEvents.length === 0 ? (
            <EventCardSkeletonList />
          ) : visibleEvents.length === 0 ? (
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
              items={visibleEvents}
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
                  isFollowingOrg={event.isFollowingOrg}
                  onToggleFollowOrg={
                    event.orgId && event.orgName
                      ? () =>
                          handleToggleFollowOrg(
                            event.orgId as string,
                            event.orgName as string,
                            Boolean(event.isFollowingOrg),
                          )
                      : undefined
                  }
                  onHideOrg={
                    event.orgId && event.orgName
                      ? () => handleHideOrg(event.orgId as string, event.orgName as string)
                      : undefined
                  }
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

          {hasMore && !loadError && visibleEvents.length > 0 && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-white px-5"
                onClick={loadMore}
                disabled={isLoadingMore || isPending}
              >
                {isLoadingMore ? "Loading…" : `Load more (${remaining} left)`}
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
