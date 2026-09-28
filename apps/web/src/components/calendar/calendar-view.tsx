"use client";

import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type CalendarEvent,
  type CalendarId,
  type MyCalendars,
  getMyCalendars,
} from "~/actions/calendar";
import { CalendarsPanel } from "~/components/calendar/calendars-panel";
import { ErrorState, LoadingState } from "~/components/common/states";
import { Button } from "~/components/ui/button";
import { addDaysToDateKey, formatTime, toZonedDateKey } from "~/lib/date-format";
import { cn } from "~/lib/utils";

/** Going = coral, Saved = cerulean, then a distinct hue per org. */
const ORG_COLORS = [
  "#2a9d8f",
  "#8b5cf6",
  "#d97706",
  "#16a34a",
  "#db2777",
  "#0e7490",
  "#b45309",
  "#4f46e5",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HIDDEN_KEY = "forum:calendar-hidden";

export function calendarColor(id: CalendarId, orgIndex: number) {
  if (id === "going") return "#ff7151";
  if (id === "saved") return "#0a9cd5";
  return ORG_COLORS[orgIndex % ORG_COLORS.length] ?? "#64748b";
}

/** Noon UTC on a date key is that same calendar date everywhere — safe for labels. */
function anchor(key: string) {
  return new Date(`${key}T12:00:00Z`);
}
function monthLabel(key: string) {
  return anchor(key).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
function dayLabel(key: string) {
  return anchor(key).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}
function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}
function weekStart(key: string) {
  return addDaysToDateKey(key, -anchor(key).getUTCDay());
}

interface Placed extends CalendarEvent {
  dayKey: string;
  color: string;
}

export function CalendarView() {
  const [data, setData] = useState<MyCalendars | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hidden, setHidden] = useState<Set<CalendarId> | null>(null);
  const today = toZonedDateKey(new Date());
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(monthStart(today));

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setData(await getMyCalendars());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Visibility: remembered per browser; suggested (unfollowed) org calendars start hidden.
  useEffect(() => {
    if (!data || hidden) return;
    let stored: CalendarId[] | null = null;
    try {
      const raw = window.localStorage.getItem(HIDDEN_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = null;
    }
    setHidden(
      new Set(
        stored ?? data.calendars.filter((c) => c.kind === "org" && !c.followed).map((c) => c.id),
      ),
    );
  }, [data, hidden]);

  const toggleCalendar = (id: CalendarId) => {
    setHidden((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      } catch {
        // per-browser convenience only
      }
      return next;
    });
  };

  const colors = useMemo(() => {
    const map = new Map<CalendarId, string>();
    let orgIndex = 0;
    for (const c of data?.calendars ?? []) {
      map.set(c.id, calendarColor(c.id, c.kind === "org" ? orgIndex++ : 0));
    }
    return map;
  }, [data]);

  /** Visible events bucketed by Princeton day, colored by their first visible calendar. */
  const byDay = useMemo(() => {
    const map = new Map<string, Placed[]>();
    if (!data || !hidden) return map;
    const order = data.calendars.map((c) => c.id);
    for (const e of data.events) {
      const visible = order.filter((id) => e.calendars.includes(id) && !hidden.has(id));
      const first = visible[0];
      if (!first) continue;
      const dayKey = toZonedDateKey(new Date(e.start));
      const list = map.get(dayKey) ?? [];
      list.push({ ...e, dayKey, color: colors.get(first) ?? "#64748b" });
      map.set(dayKey, list);
    }
    return map;
  }, [data, hidden, colors]);

  if (status === "loading" && !data) return <LoadingState label="Loading your calendar…" />;
  if (status === "error" || !data) {
    return <ErrorState title="Couldn't load your calendar" onRetry={load} />;
  }

  // Month grid: 6 weeks starting on the Sunday on/before the 1st.
  const gridStart = weekStart(month);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysToDateKey(gridStart, i));
  const week = Array.from({ length: 7 }, (_, i) => addDaysToDateKey(weekStart(selected), i));
  const agenda = byDay.get(selected) ?? [];
  const nextUpcoming = [...byDay.entries()]
    .filter(([k]) => k > selected)
    .sort(([a], [b]) => a.localeCompare(b))[0];

  const select = (key: string) => {
    setSelected(key);
    setMonth(monthStart(key));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label="Calendar" className="min-w-0">
        {/* Header: month (desktop) / week (phones) navigation */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-serif text-[20px] font-semibold text-black">
            <span className="hidden md:inline">{monthLabel(month)}</span>
            <span className="md:hidden">{monthLabel(selected)}</span>
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => select(today)}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous"
              onClick={() => {
                if (window.matchMedia("(min-width: 768px)").matches) setMonth(addMonths(month, -1));
                else select(addDaysToDateKey(selected, -7));
              }}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next"
              onClick={() => {
                if (window.matchMedia("(min-width: 768px)").matches) setMonth(addMonths(month, 1));
                else select(addDaysToDateKey(selected, 7));
              }}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        {/* Month grid — md and up */}
        <div className="hidden overflow-hidden rounded-[20px] border border-forum-border bg-white md:block">
          <div className="grid grid-cols-7 border-b border-forum-border bg-forum-bg">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-1.5 text-center font-dm-sans text-[11px] font-semibold uppercase tracking-wide text-forum-light-gray"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((key, i) => {
              const inMonth = key.slice(0, 7) === month.slice(0, 7);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-pressed={isSelected}
                  aria-label={`${dayLabel(key)}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`}
                  className={cn(
                    "flex min-h-[104px] flex-col gap-1 border-forum-border p-1.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forum-cerulean",
                    i % 7 !== 6 && "border-r",
                    i < 35 && "border-b",
                    inMonth ? "bg-white" : "bg-forum-bg/70",
                    isSelected ? "bg-forum-turquoise/15" : "hover:bg-forum-turquoise/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center self-end rounded-full font-dm-sans text-[12px]",
                      isToday
                        ? "bg-forum-coral font-bold text-white"
                        : inMonth
                          ? "text-black"
                          : "text-forum-light-gray",
                    )}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="flex min-w-0 items-center gap-1 rounded px-1 py-px font-dm-sans text-[11px] leading-tight"
                      style={{ background: `${e.color}1f` }}
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: e.color }}
                      />
                      <span className="shrink-0 text-forum-dark-gray">
                        {formatTime(new Date(e.start)).replace(":00", "").replace(" ", "")}
                      </span>
                      <span className="min-w-0 truncate text-black">{e.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="px-1 font-dm-sans text-[11px] font-medium text-forum-cerulean">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Week strip — phones */}
        <div className="grid grid-cols-7 gap-1 md:hidden">
          {week.map((key) => {
            const count = byDay.get(key)?.length ?? 0;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${dayLabel(key)}, ${count} ${count === 1 ? "event" : "events"}`}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl border py-2 font-dm-sans transition-colors",
                  isSelected
                    ? "border-forum-coral bg-forum-coral-light"
                    : "border-forum-border bg-white",
                )}
              >
                <span className="text-[10px] uppercase text-forum-light-gray">
                  {WEEKDAYS[anchor(key).getUTCDay()]}
                </span>
                <span
                  className={cn(
                    "text-[15px] font-semibold",
                    key === today ? "text-forum-coral" : "text-black",
                  )}
                >
                  {Number(key.slice(8))}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {(byDay.get(key) ?? []).slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: e.color }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Agenda for the selected day */}
        <div className="mt-4">
          <h3 className="mb-2 font-dm-sans text-[13px] font-semibold text-black">
            {selected === today ? "Today" : dayLabel(selected)}
          </h3>
          {agenda.length > 0 ? (
            <ul className="divide-y divide-forum-border overflow-hidden rounded-[20px] border border-forum-border bg-white">
              {agenda.map((e) => (
                <li
                  key={e.id}
                  className="relative flex gap-3 px-4 py-2.5 hover:bg-forum-turquoise/10"
                >
                  <span
                    aria-hidden
                    className="mt-1 w-1 shrink-0 self-stretch rounded-full"
                    style={{ background: e.color }}
                  />
                  <div className="min-w-0 flex-1 font-dm-sans">
                    <Link
                      href={`/events/${e.id}`}
                      className="block truncate text-[14px] font-semibold text-black after:absolute after:inset-0 hover:underline"
                    >
                      {e.title}
                    </Link>
                    <p className="truncate text-[12px] text-forum-dark-gray">
                      {formatTime(new Date(e.start))}
                      {e.end && ` – ${formatTime(new Date(e.end))}`}
                      {e.orgName && ` · ${e.orgName}`}
                    </p>
                    {e.location && (
                      <p className="flex items-center gap-1 truncate text-[12px] text-forum-light-gray">
                        <MapPin size={11} aria-hidden />
                        {e.location}
                        {e.locationDetail && ` · ${e.locationDetail}`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-dm-sans text-[13px] text-forum-light-gray">
              Nothing on your calendars this day.
              {nextUpcoming && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => select(nextUpcoming[0])}
                    className="font-medium text-forum-cerulean hover:underline"
                  >
                    Next: {dayLabel(nextUpcoming[0])} →
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </section>

      <CalendarsPanel
        data={data}
        colors={colors}
        hidden={hidden ?? new Set()}
        onToggle={toggleCalendar}
        onReset={load}
      />
    </div>
  );
}
