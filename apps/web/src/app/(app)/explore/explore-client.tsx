"use client";

import { Expand } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  type FeedEvent,
  type FriendsEvent,
  getFeedEvents,
  toggleRsvp,
  toggleSave,
} from "~/actions/events";
import { Panel } from "~/components/common/panel";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState, EventCardSkeletonList } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { EventFilters } from "~/components/events/event-filters";
import { PageHeading, PageShell, SectionHeading } from "~/components/layout/page-shell";
import { formatEventDateTime } from "~/lib/date-format";

interface ExploreClientProps {
  initialEvents: FeedEvent[];
  initialTotal: number;
  savedEvents: FeedEvent[];
  friendsEvents: FriendsEvent[];
  initialSearch?: string;
  userName?: string;
  userAvatarUrl?: string | null;
}

// fake temporary event for UI testing
const demoEvent: FeedEvent = {
  // Use a valid UUID so server-side DB operations don't error on demo data
  id: "00000000-0000-0000-0000-000000000000",
  title: "Fake Event",
  description: "Practice event data for UI testing.",
  orgId: "tigerapps",
  orgName: "TigerApps",
  // Use a fixed demo timestamp so server and client HTML match during hydration
  datetime: formatEventDateTime(new Date("2026-06-17T22:25:00Z")),
  location: "Lewis 122",
  tags: ["music", "free food", "performing arts"],
  flyerUrl: null,
  rsvpCount: 42,
  friendsAttending: [
    { id: "user-1", displayName: "Donald Grump", avatarUrl: null },
    { id: "user-2", displayName: "Elvis Parsley", avatarUrl: null },
  ],
  isRsvped: false,
  isSaved: false,
};

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
  const fallbackEvents = initialEvents.length > 0 ? initialEvents : [demoEvent];
  const [events, setEvents] = useState(fallbackEvents);
  const [_total, setTotal] = useState(initialEvents.length > 0 ? initialTotal : 1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
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

  const handleRsvpToggle = useCallback(async (eventId: string) => {
    const result = await toggleRsvp(eventId);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, isRsvped: result.rsvped, rsvpCount: result.count } : e,
      ),
    );
  }, []);

  const upcomingList = useMemo(
    () => (savedEvents.length > 0 ? savedEvents : events).slice(0, 3),
    [savedEvents, events],
  );

  return (
    <PageShell width="wide" className="flex h-full gap-8">
      {/* CENTER — Feed */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto">
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
          placeholder="Search for free boba, music concerts, tabling events"
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
                }}
                onHide={() => {
                  setEvents((prev) => prev.filter((e) => e.id !== event.id));
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <aside
        aria-label="Highlights"
        className="hidden w-[320px] shrink-0 flex-col gap-6 overflow-y-auto xl:flex"
      >
        {/* Find My Friends */}
        <section>
          <SectionHeading>Find My Friends</SectionHeading>
          <Link
            href="/map"
            className="group relative block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
          >
            <div className="h-[240px] overflow-hidden rounded-lg border border-forum-border">
              <div className="w-full h-full bg-[#f0f4ee] relative">
                <div className="absolute inset-0 opacity-12">
                  <div className="absolute top-0 left-[25%] w-[1px] h-full bg-gray-400" />
                  <div className="absolute top-0 left-[55%] w-[1px] h-full bg-gray-400" />
                  <div className="absolute top-0 left-[80%] w-[1px] h-full bg-gray-400" />
                  <div className="absolute top-[30%] left-0 w-full h-[1px] bg-gray-400" />
                  <div className="absolute top-[60%] left-0 w-full h-[1px] bg-gray-400" />
                </div>
                <span className="absolute top-[6%] right-[5%] text-[7px] font-bold text-gray-400 tracking-widest uppercase">
                  Morrison
                </span>
                <span className="absolute top-[42%] left-[10%] text-[8px] font-bold text-gray-500 tracking-wider uppercase">
                  Versity Place
                </span>
                <span className="absolute bottom-[6%] right-[6%] text-[7px] font-bold text-gray-400 tracking-widest uppercase">
                  Museum
                </span>
                <span className="absolute bottom-[18%] left-[3%] text-[7px] font-bold text-gray-400">
                  Dillon Gym
                </span>
                <div className="absolute top-[16%] right-[8%]">
                  <div className="bg-white/95 rounded-full px-[8px] py-[2px] shadow text-[9px] font-bold text-black">
                    Select Location
                  </div>
                </div>
                <div className="absolute top-[22%] right-[20%] flex flex-col items-center">
                  <div className="w-[36px] h-[36px] rounded-full border-[2px] border-white shadow bg-forum-turquoise/40 flex items-center justify-center text-[12px] font-bold">
                    AJ
                  </div>
                  <span className="mt-[1px] bg-white/90 rounded-full px-[5px] text-[8px] font-bold text-black">
                    AJ
                  </span>
                </div>
                <div className="absolute bottom-[24%] left-[20%] flex flex-col items-center">
                  <div className="w-[36px] h-[36px] rounded-full border-[2px] border-white shadow bg-forum-pink/60 flex items-center justify-center text-[12px] font-bold">
                    PK
                  </div>
                  <span className="mt-[1px] bg-white/90 rounded-full px-[5px] text-[8px] font-bold text-black">
                    PK
                  </span>
                </div>
                <div className="absolute bottom-[24%] left-[40%] flex flex-col items-center">
                  <div className="w-[36px] h-[36px] rounded-full border-[2px] border-white shadow bg-forum-yellow/60 flex items-center justify-center text-[12px] font-bold">
                    AR
                  </div>
                  <span className="mt-[1px] bg-white/90 rounded-full px-[5px] text-[8px] font-bold text-black">
                    AR
                  </span>
                </div>
              </div>
              <div className="absolute top-[8px] right-[8px]">
                <Expand
                  size={14}
                  className="text-forum-dark-gray group-hover:text-black transition-colors"
                />
              </div>
            </div>
          </Link>
        </section>

        {/* Upcoming Events */}
        <section>
          <SectionHeading>Upcoming Events</SectionHeading>
          <Panel size="sm" className="flex flex-col">
            {upcomingList.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-2.5 rounded-lg px-0.5 py-2 transition-colors hover:bg-forum-turquoise/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
              >
                <div className="size-[40px] shrink-0 overflow-hidden rounded border-2 border-forum-medium-gray">
                  {event.flyerUrl ? (
                    <img src={event.flyerUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full bg-forum-pink/40" />
                  )}
                </div>
                <p className="min-w-0 flex-1 font-dm-sans text-[13px] leading-snug text-black line-clamp-2">
                  {event.title}
                </p>
                <span className="shrink-0 rounded border border-forum-border px-1.5 py-[3px] font-dm-sans text-[9px] font-bold tracking-wide text-forum-light-gray">
                  DETAILS
                </span>
              </Link>
            ))}
            {upcomingList.length === 0 && (
              <p className="py-1.5 font-dm-sans text-[12px] text-forum-light-gray">
                No upcoming events yet.
              </p>
            )}
          </Panel>
        </section>
      </aside>
    </PageShell>
  );
}
