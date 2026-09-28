/**
 * Minimal RFC 5545 (iCalendar) generator for The Forum's calendar feeds.
 *
 * Times are written in UTC ("Z"); X-WR-TIMEZONE tells clients the calendar
 * lives in America/New_York. Text values are escaped (\\ ; , and newlines),
 * lines are folded at 75 octets (UTF-8 safe) and terminated with CRLF.
 */

export interface IcsEvent {
  id: string;
  title: string;
  start: Date;
  /** Defaults to start + 1 hour when missing (or not after start). */
  end?: Date | null;
  /** Venue name. */
  location?: string | null;
  /** Room / free-text place, appended to the venue: "Frist Campus Center, Room 207". */
  locationDetail?: string | null;
  description?: string | null;
  /** Absolute URL of the event page. */
  url?: string | null;
  /** Last change, for DTSTAMP/LAST-MODIFIED; defaults to the calendar's `now`. */
  updatedAt?: Date | null;
}

export interface IcsCalendar {
  name: string;
  description?: string;
  events: IcsEvent[];
  /** Generation time (DTSTAMP); injectable for tests. */
  now?: Date;
}

const UID_DOMAIN = "forum.tigerapps.org";
const ONE_HOUR_MS = 60 * 60 * 1000;
const CRLF = "\r\n";

/** 2026-09-28T22:00:00.000Z → 20260928T220000Z */
export function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escape a TEXT value per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Fold a content line so no physical line exceeds 75 octets; continuation
 * lines start with a single space. Never splits a UTF-8 character.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75; // first line; continuations have 74 + the leading space
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += ch;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** Canonical event location: venue plus room ("Frist Campus Center, Room 207"). */
export function eventLocationText(
  location: string | null | undefined,
  detail: string | null | undefined,
): string {
  return [location, detail]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
    .join(", ");
}

/** End time used everywhere we export an event: its end, or start + 1h. */
export function eventEndOrDefault(start: Date, end: Date | null | undefined): Date {
  return end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + ONE_HOUR_MS);
}

function prop(name: string, value: string) {
  return foldIcsLine(`${name}:${value}`);
}

export function buildIcsCalendar(calendar: IcsCalendar): string {
  const now = calendar.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TigerApps//The Forum//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("X-WR-CALNAME", escapeIcsText(calendar.name)),
    "X-WR-TIMEZONE:America/New_York",
  ];
  if (calendar.description) {
    lines.push(prop("X-WR-CALDESC", escapeIcsText(calendar.description)));
  }
  // Ask subscribers to refresh roughly hourly.
  lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H");

  for (const event of calendar.events) {
    const end = eventEndOrDefault(event.start, event.end);
    lines.push(
      "BEGIN:VEVENT",
      prop("UID", `${event.id}@${UID_DOMAIN}`),
      prop("DTSTAMP", formatIcsDate(now)),
      prop("DTSTART", formatIcsDate(event.start)),
      prop("DTEND", formatIcsDate(end)),
      prop("SUMMARY", escapeIcsText(event.title)),
    );
    const location = eventLocationText(event.location, event.locationDetail);
    if (location) lines.push(prop("LOCATION", escapeIcsText(location)));
    const description = [event.description?.trim(), event.url].filter(Boolean).join("\n\n");
    if (description) lines.push(prop("DESCRIPTION", escapeIcsText(description)));
    if (event.url) lines.push(prop("URL", event.url));
    if (event.updatedAt) lines.push(prop("LAST-MODIFIED", formatIcsDate(event.updatedAt)));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}
