"use client";

import { Expand, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  type FeedEvent,
  type FriendsEvent,
  getFeedEvents,
  toggleRsvp,
  toggleSave,
} from "~/actions/events";
import { EventCard } from "~/components/events/event-card";
import { EventFilters } from "~/components/events/event-filters";
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
  tags: ["music", "free-food", "performance"],
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
    <div className="flex h-full py-10">
      {/* CENTER — Feed */}
      <div className="flex-1 flex flex-col gap-5 overflow-y-auto px-5">
        {/* Greeting */}
        <div className="flex flex-col">
          <h1 className="font-serif text-[52px]">
            <span className="font-normal">Hi </span>
            <span className="font-bold italic">{firstName},</span>
          </h1>
          <div className="flex items-center gap-[8px]">
            <div className="w-[12px] h-[12px] rounded-full bg-forum-coral flex-shrink-0" />
            <p className="font-serif italic text-[18px] text-black">Today is {getTodayString()}</p>
          </div>
        </div>

        {/* Search */}
        <div>
          <div className="flex items-center h-[36px] bg-white rounded-[8px] border-1 border-forum-medium-gray px-[14px]">
            <Search size={14} className="text-forum-placeholder mr-[8px] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search for free boba, music concerts, tabling events"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="bg-transparent text-[14px] font-dm-sans text-black placeholder:text-[#a6a8ae] outline-none flex-1 min-w-0"
            />
          </div>
        </div>

        {/* Filters */}
        <div>
          <EventFilters activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />
        </div>

        {/* Feed */}
        <div className="flex flex-col gap-5 px-10">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[60px] text-center">
              <p className="font-serif text-[22px] text-forum-dark-gray">
                {isPending ? "Loading events..." : "No events found"}
              </p>
              <p className="text-[13px] text-forum-light-gray mt-[4px]">
                {activeFilters.length > 0 || searchQuery
                  ? "Try adjusting your filters or search."
                  : "Events will appear here once they're created."}
              </p>
            </div>
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
      <div className="hidden xl:flex flex-col w-[320px] flex-shrink-0 overflow-y-auto pt-[8px] pr-[14px] pl-[4px] pb-[24px]">
        {/* Create Event */}
        <div className="relative h-[80px] mb-[14px]">
          <div className="absolute left-[8px] top-0 w-[190px] h-[44px] rounded-[14px] bg-forum-turquoise flex items-center justify-center rotate-[13deg]" />
          <Link
            href="/events/create"
            className="absolute left-0 top-[20px] w-[190px] h-[44px] rounded-[14px] bg-forum-cerulean flex items-center justify-center gap-[6px] hover:opacity-90 transition-opacity shadow-md"
          >
            <Plus size={16} className="text-white" />
            <span className="text-[13px] font-bold font-dm-sans text-white tracking-wide">
              CREATE AN EVENT
            </span>
          </Link>
        </div>

        {/* Find My Friends */}
        <div className="mb-[16px]">
          <div className="flex items-center gap-[8px] mb-[8px]">
            <div className="w-[11px] h-[11px] rounded-full bg-forum-cerulean flex-shrink-0" />
            <h2 className="font-serif text-[18px] text-black font-bold">Find My Friends</h2>
          </div>
          <Link href="/map" className="block relative group">
            <div className="h-[240px] rounded-[10px] overflow-hidden border border-gray-100">
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
        </div>

        {/* Upcoming Events */}
        <div>
          <div className="flex items-center gap-[8px] mb-[8px]">
            <div className="w-[11px] h-[11px] rounded-full bg-forum-cerulean flex-shrink-0" />
            <h2 className="font-serif text-[18px] text-black font-bold">Upcoming Events</h2>
          </div>
          <div className="flex flex-col">
            {upcomingList.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-[10px] py-[8px] px-[2px] rounded-[8px] hover:bg-forum-turquoise/5 transition-colors"
              >
                <div className="w-[40px] h-[40px] rounded-[4px] border-[2px] border-forum-medium-gray overflow-hidden flex-shrink-0">
                  {event.flyerUrl ? (
                    <img
                      src={event.flyerUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-forum-pink/40" />
                  )}
                </div>
                <p className="flex-1 min-w-0 text-[13px] font-dm-sans text-black leading-snug line-clamp-2">
                  {event.title}
                </p>
                <span className="border border-forum-medium-gray rounded-[6px] px-[6px] py-[3px] text-[9px] font-bold text-forum-light-gray tracking-wide flex-shrink-0">
                  DETAILS
                </span>
              </Link>
            ))}
            {upcomingList.length === 0 && (
              <p className="text-[12px] text-forum-light-gray py-[6px]">No upcoming events yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
