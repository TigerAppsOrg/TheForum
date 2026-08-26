"use client";

import { Bookmark, CalendarDays, Clock, MapPin, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { type FeedEvent, toggleRsvp } from "~/actions/events";
import { cn } from "~/lib/utils";

const TABS = [
  { id: "saved", label: "Saved" },
  { id: "rsvped", label: "My RSVPs" },
  { id: "friends", label: "Find Friends" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface MyEventsClientProps {
  rsvped: FeedEvent[];
  saved: FeedEvent[];
  friends: FeedEvent[];
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function EventCard({ event }: { event: FeedEvent }) {
  const tagStyle = event.tags?.[0] ? "bg-[#e6f7ff] text-[#0f172a]" : "bg-[#eefcf6] text-[#0f172a]";
  const [isRsvped, setIsRsvped] = useState(event.isRsvped);
  const [isPending, startTransition] = useTransition();

  const buildGoogleCalendarUrl = () => {
    const start = event.datetimeIso ? new Date(event.datetimeIso) : new Date();
    const end = event.endDatetimeIso
      ? new Date(event.endDatetimeIso)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (value: Date) =>
      value
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: event.description ?? "",
      location: event.location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleRsvpToggle = () => {
    const next = !isRsvped;
    setIsRsvped(next);
    startTransition(async () => {
      const result = await toggleRsvp(event.id);
      setIsRsvped(result.rsvped);
    });
  };

  return (
    <div className="rounded-[14px] border border-[#dfe2cb] bg-[#f8f4d7]/80 p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#2d2d2d]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d7d4c5] bg-[#f5f5f0] text-[#1f2937]">
            <CalendarDays size={12} />
          </div>
          <span>{event.orgName ?? "Princeton TigerApps"}</span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={buildGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[#dfe2cb] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f3b45]"
          >
            + Added to calendar
          </a>
          <button
            type="button"
            disabled={isPending}
            onClick={handleRsvpToggle}
            className="rounded-md bg-[#1ea9d7] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRsvped ? "Cancel RSVP" : "RSVP"}
          </button>
          <Link
            href={`/events/${event.id}`}
            aria-label="Open event"
            className="rounded-md border border-[#dfe2cb] bg-white/70 p-1.5 text-[#2f3b45]"
          >
            ↗
          </Link>
        </div>
      </div>

      <div className="mb-3 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/events/${event.id}`}
            className="block font-serif text-[22px] leading-tight text-black hover:text-[#1ea9d7]"
          >
            {event.title}
          </Link>

          <div className="mt-2 space-y-1.5 text-[14px] text-[#4b5563]">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-[#4b5563]" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[#4b5563]" />
              <span>{event.datetime}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {event.tags.length > 0 ? (
            event.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tagStyle)}
              >
                {tag}
              </span>
            ))
          ) : (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tagStyle)}>
              free food
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[#4b5563]">
          {event.rsvpCount > 0 && (
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(3, event.rsvpCount) }).map((_, index) => (
                <div
                  key={`${event.id}-avatar-${index}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#f8f4d7] bg-[#dfe8f9] text-[9px] font-semibold text-[#1e293b]"
                >
                  {index === 0 ? "Y" : index === 1 ? "A" : "+"}
                </div>
              ))}
            </div>
          )}
          <span className="text-[12px] font-medium text-[#2d2d2d]">
            {event.rsvpCount === 0
              ? "No RSVPs yet"
              : event.rsvpCount === 1
                ? "1 attending"
                : `${event.rsvpCount} attending`}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MyEventsClient({ rsvped, saved, friends }: MyEventsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("rsvped");

  const eventsByTab = useMemo(
    () => ({
      saved,
      rsvped,
      friends,
    }),
    [saved, rsvped, friends],
  );

  const tabMeta: Record<TabId, { title: string; body: string }> = {
    saved: {
      title: "No saved events yet",
      body: "Bookmark events you want to keep on your radar.",
    },
    rsvped: {
      title: "No upcoming RSVPs",
      body: "Explore events and RSVP to the ones you want to attend.",
    },
    friends: {
      title: "No friend activity yet",
      body: "When your friends RSVP, their events will appear here.",
    },
  };

  const currentEvents = eventsByTab[activeTab];

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[56px] leading-[0.95] tracking-[-0.04em] text-black md:text-[64px]">
            My Events
          </h1>
          <div className="mt-3 flex items-center gap-2 text-[17px] text-[#334155]">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#12b9a8]" />
            <span>Today is {formatTodayLabel()}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-[#d8dadd]">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative mx-auto w-full max-w-[260px] pb-3 text-center text-[16px] font-semibold uppercase tracking-[0.08em] transition-colors",
                activeTab === id ? "text-[#1ea9d7]" : "text-[#4b5563]",
              )}
            >
              {label}
              {activeTab === id && (
                <span className="absolute -bottom-[1px] left-1/2 h-[3px] w-[calc(100%-18px)] -translate-x-1/2 rounded-full bg-[#1ea9d7]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 space-y-6 pb-8">
        {currentEvents.length > 0 ? (
          currentEvents.map((event) => <EventCard key={event.id} event={event} />)
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[18px] border border-dashed border-[#dfe2cb] bg-[#faf9f2] py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#4b5563] shadow-sm">
              {activeTab === "saved" ? (
                <Bookmark size={24} />
              ) : activeTab === "rsvped" ? (
                <UserRoundCheck size={24} />
              ) : (
                <CalendarDays size={24} />
              )}
            </div>
            <h3 className="text-[28px] font-semibold text-[#1f2937]">{tabMeta[activeTab].title}</h3>
            <p className="mt-2 max-w-md text-[16px] text-[#4b5563]">{tabMeta[activeTab].body}</p>
          </div>
        )}
      </div>
    </div>
  );
}
