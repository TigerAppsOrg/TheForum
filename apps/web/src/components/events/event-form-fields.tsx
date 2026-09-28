"use client";

import { format } from "date-fns";
import { CalendarIcon, MapPin, Search } from "lucide-react";
import { useRef, useState } from "react";
import { FilterChip } from "~/components/common/filter-chip";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { formatMediumDate, formatTime, zonedDateTimeToDate } from "~/lib/date-format";
import { INTEREST_OPTIONS } from "~/lib/profile-options";
import { cn } from "~/lib/utils";

/*
 * Pieces shared by the Create and Edit event forms, so the two can't drift the
 * way they had (text time boxes on one, native time inputs on the other; a
 * silent "frist" location default on one only).
 */

export const FORM_LABEL = "text-[13px] font-bold text-forum-coral block mb-[6px]";
export const FORM_ERROR = "text-[11px] text-forum-coral mt-1";

/** Seeded catch-all location (see apps/database seed + pipeline fallback). */
export const OTHER_LOCATION_ID = "other";

export type CampusLocation = { id: string; name: string; category: string };

export interface EventWhen {
  /** "YYYY-MM-DD" — the Princeton calendar day. */
  dateKey: string;
  /** "HH:MM", 24h. */
  startTime: string;
  /** "HH:MM", 24h, or "" for no end time. */
  endTime: string;
}

export type WhenErrors = Partial<Record<"date" | "startTime" | "endTime", string>>;

/**
 * Validate and combine the form's date + times into ISO instants, interpreting
 * the wall-clock values in America/New_York — not the organizer's browser zone.
 */
export function resolveEventWhen(
  when: EventWhen,
): { ok: true; datetime: Date; endDatetime: Date | null } | { ok: false; errors: WhenErrors } {
  const errors: WhenErrors = {};
  if (!when.dateKey) errors.date = "Pick a date";
  if (!when.startTime) errors.startTime = "Pick a start time";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const datetime = zonedDateTimeToDate(when.dateKey, when.startTime);
  const endDatetime = when.endTime ? zonedDateTimeToDate(when.dateKey, when.endTime) : null;
  if (endDatetime && endDatetime.getTime() <= datetime.getTime()) {
    return { ok: false, errors: { endTime: "End time must be after the start time" } };
  }
  return { ok: true, datetime, endDatetime };
}

/** Human-readable when-line for the preview modal. */
export function describeEventWhen(when: EventWhen) {
  if (!when.dateKey) return { datetime: "", endTime: "" };
  if (!when.startTime) {
    return {
      datetime: formatMediumDate(zonedDateTimeToDate(when.dateKey, "12:00")),
      endTime: "",
    };
  }
  const start = zonedDateTimeToDate(when.dateKey, when.startTime);
  return {
    datetime: `${formatMediumDate(start)} · ${formatTime(start)}`,
    endTime: when.endTime ? formatTime(zonedDateTimeToDate(when.dateKey, when.endTime)) : "",
  };
}

/**
 * Returns a URL with a scheme, or null if it can't be one. "www.x.com" used to
 * be saved verbatim and rendered as a link relative to the Forum itself.
 */
export function normalizeExternalLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    // The server only accepts https links without credentials (lib/validation.ts).
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function dateKeyToLocalDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function EventWhenFields({
  value,
  onChange,
  errors,
  disablePastDates = false,
}: {
  value: EventWhen;
  onChange: (next: EventWhen) => void;
  errors: WhenErrors;
  disablePastDates?: boolean;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selected = value.dateKey ? dateKeyToLocalDate(value.dateKey) : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <fieldset>
      <legend className="sr-only">Date and time</legend>
      <div className="flex flex-wrap items-start gap-x-[20px] gap-y-3">
        <div>
          <span id="event-date-label" className={FORM_LABEL}>
            Date *
          </span>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-labelledby="event-date-label"
                aria-invalid={errors.date ? true : undefined}
                className={cn(
                  "flex items-center gap-2 h-[40px] px-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans",
                  selected ? "text-black" : "text-forum-placeholder",
                  errors.date && "border-forum-coral",
                )}
              >
                <CalendarIcon size={14} aria-hidden />
                {selected ? format(selected, "EEE, MMM d, yyyy") : "Select a date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selected}
                defaultMonth={selected}
                onSelect={(d) => {
                  onChange({ ...value, dateKey: d ? format(d, "yyyy-MM-dd") : "" });
                  setCalendarOpen(false);
                }}
                disabled={disablePastDates ? { before: today } : undefined}
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className={FORM_ERROR}>{errors.date}</p>}
        </div>

        <div>
          <label htmlFor="event-start" className={FORM_LABEL}>
            Start *
          </label>
          <Input
            id="event-start"
            type="time"
            value={value.startTime}
            onChange={(e) => onChange({ ...value, startTime: e.target.value })}
            aria-invalid={errors.startTime ? true : undefined}
            className="h-[40px] w-[140px] rounded-[8px] border-forum-medium-gray text-[13px] font-dm-sans"
          />
          {errors.startTime && <p className={FORM_ERROR}>{errors.startTime}</p>}
        </div>

        <div>
          <label htmlFor="event-end" className={FORM_LABEL}>
            End
          </label>
          <Input
            id="event-end"
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ ...value, endTime: e.target.value })}
            aria-invalid={errors.endTime ? true : undefined}
            className="h-[40px] w-[140px] rounded-[8px] border-forum-medium-gray text-[13px] font-dm-sans"
          />
          {errors.endTime && <p className={FORM_ERROR}>{errors.endTime}</p>}
        </div>
      </div>
      <p className="mt-2 font-dm-sans text-[11px] text-forum-light-gray">
        Times are Princeton time (Eastern).
      </p>
    </fieldset>
  );
}

export function LocationPicker({
  locations,
  value,
  onChange,
  error,
}: {
  locations: CampusLocation[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const otherLocation = locations.find((l) => l.id === OTHER_LOCATION_ID);
  const campusLocations = locations.filter((l) => l.id !== OTHER_LOCATION_ID);
  const filtered = campusLocations.filter(
    (loc) => !search || loc.name.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedName =
    value === OTHER_LOCATION_ID
      ? "Other / off-campus / TBA"
      : (locations.find((l) => l.id === value)?.name ?? "");

  const pick = (id: string) => {
    onChange(id);
    setSearch("");
    setOpen(false);
  };

  return (
    <div>
      <label htmlFor="event-location" className={FORM_LABEL}>
        Location *
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        {/* An anchor, not a trigger: a trigger toggles on click, which closed
            the list again right after focusing the field opened it. */}
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative">
            <Search
              size={14}
              aria-hidden
              className="absolute left-[12px] top-1/2 -translate-y-1/2 text-forum-placeholder"
            />
            <input
              id="event-location"
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls="event-location-list"
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              value={open ? search : selectedName}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  listRef.current?.querySelector("button")?.focus();
                }
              }}
              placeholder="Search campus buildings"
              className={cn(
                "w-full h-[40px] pl-[34px] pr-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans outline-none focus:border-forum-cerulean",
                error && "border-forum-coral",
              )}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={listRef}
          id="event-location-list"
          className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => pick(loc.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  value === loc.id
                    ? "bg-forum-turquoise/20 text-black"
                    : "text-forum-dark-gray hover:bg-forum-turquoise/10",
                )}
              >
                {loc.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-forum-light-gray">No campus buildings match.</p>
            )}
          </div>
          {otherLocation && (
            <div className="border-t border-forum-medium-gray p-1">
              <button
                type="button"
                onClick={() => pick(otherLocation.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  value === otherLocation.id
                    ? "bg-forum-turquoise/20 text-black"
                    : "text-forum-dark-gray hover:bg-forum-turquoise/10",
                )}
              >
                <MapPin size={13} aria-hidden className="text-forum-light-gray" />
                Other / off-campus / TBA
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value === OTHER_LOCATION_ID && (
        <p className="mt-1 font-dm-sans text-[11px] text-forum-light-gray">
          Add the exact place to the description so people can find it.
        </p>
      )}
      {error && <p className={FORM_ERROR}>{error}</p>}
    </div>
  );
}

/**
 * Tags are the fixed event_tag set the feed ranks on. The old free-text box
 * silently dropped anything outside that set on save; offering only the real
 * values makes what you pick what gets saved.
 */
export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  return (
    <fieldset>
      <legend className={FORM_LABEL}>Tags</legend>
      <p className="mb-2.5 font-dm-sans text-[11px] text-forum-light-gray">
        Pick the topics that fit — they decide who sees this in their feed.
      </p>
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map(({ value: tag }) => (
          <FilterChip key={tag} active={value.includes(tag)} onClick={() => toggle(tag)}>
            {tag}
          </FilterChip>
        ))}
      </div>
    </fieldset>
  );
}

/** Accessible on/off switch for the public/private setting. */
export function VisibilityToggle({
  isPublic,
  onChange,
}: {
  isPublic: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPublic}
      aria-label="Public event"
      onClick={() => onChange(!isPublic)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
        isPublic ? "bg-forum-cerulean" : "bg-forum-medium-gray",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          isPublic ? "translate-x-5.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
