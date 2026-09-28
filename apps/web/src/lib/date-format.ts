/**
 * Date/time helpers for The Forum.
 *
 * Every event happens in Princeton, so every date and time is rendered in
 * America/New_York regardless of where the code runs. Server actions execute
 * in UTC on the host and browsers can be anywhere (a student abroad, a laptop
 * still set to home time), so relying on the runtime's local zone put evening
 * events on the wrong day and showed 6pm talks as 10pm.
 *
 * Use these helpers — never bare `toLocaleString()` / `getHours()` — for
 * anything a user reads or anything that buckets events by calendar day.
 */

export const EVENT_TIME_ZONE = "America/New_York";

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/** Wall-clock components of `date` as seen in Princeton. */
export function getZonedParts(date: Date) {
  const parts = PARTS_FORMATTER.formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(partValue(parts, type));
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** "YYYY-MM-DD" for the Princeton calendar day `date` falls on. */
export function toZonedDateKey(date: Date) {
  const { year, month, day } = getZonedParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "HH:MM" (24h) Princeton wall-clock time — the value an `<input type="time">` expects. */
export function toZonedTimeValue(date: Date) {
  const { hour, minute } = getZonedParts(date);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Shift a "YYYY-MM-DD" key by whole calendar days. */
export function addDaysToDateKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

/** Whole calendar days between two Princeton dates (b − a). */
function dateKeyDiff(a: string, b: string) {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Calendar-day distance from `now` to `date`, in Princeton. 0 = today, 1 = tomorrow. */
export function zonedDayDiff(date: Date, now = new Date()) {
  return dateKeyDiff(toZonedDateKey(now), toZonedDateKey(date));
}

/** Milliseconds Princeton is offset from UTC at `instant` (e.g. −4h in EDT). */
function zoneOffsetMs(instant: number) {
  const p = getZonedParts(new Date(instant));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant at which it is `time` ("HH:MM") on `dateKey` ("YYYY-MM-DD") in
 * Princeton. Used by the event forms so an organizer anywhere in the world who
 * enters "6:00 PM" gets 6pm Eastern, across DST changes.
 */
export function zonedDateTimeToDate(dateKey: string, time: string) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const first = guess - zoneOffsetMs(guess);
  // Re-check at the corrected instant in case the guess straddled a DST switch.
  const second = guess - zoneOffsetMs(first);
  return new Date(second);
}

/** "Fri, Mar 3 at 6:00 PM" — the standard event line on cards. */
export function formatEventDateTime(date: Date) {
  const parts = EVENT_DATE_FORMATTER.formatToParts(date);
  const weekday = partValue(parts, "weekday");
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  const hour = partValue(parts, "hour");
  const minute = partValue(parts, "minute");
  const dayPeriod = partValue(parts, "dayPeriod");

  return `${weekday}, ${month} ${day} at ${hour}:${minute} ${dayPeriod}`;
}

/** "Monday, September 28, 2026" */
export function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "Mon, Sep 28, 2026" */
export function formatMediumDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "6:00 PM" */
export function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Mon" */
export function formatWeekdayShort(date: Date) {
  return date.toLocaleDateString("en-US", { timeZone: EVENT_TIME_ZONE, weekday: "short" });
}

/** "Mon 6:00 PM" */
export function formatWeekdayTime(date: Date) {
  return date.toLocaleString("en-US", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** { month: "SEP", day: "28", weekday: "Mon" } — the date block on list rows. */
export function formatDateBadge(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    month: "short",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  return {
    month: partValue(parts, "month").toUpperCase(),
    day: partValue(parts, "day"),
    weekday: partValue(parts, "weekday"),
  };
}

/** "Monday, 16 March 2026" — the greeting line on Home, in Princeton time. */
export function formatGreetingDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => partValue(parts, t);
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`;
}

/** "Sep 28" */
export function formatMonthDay(date: Date) {
  return date.toLocaleDateString("en-US", {
    timeZone: EVENT_TIME_ZONE,
    month: "short",
    day: "numeric",
  });
}

/**
 * "today" / "tomorrow" / "on Fri, Mar 3" — for sentences like
 * "TigerApps Social is happening tomorrow!".
 *
 * Compares Princeton calendar days rather than elapsed hours, so an event at
 * 9am tomorrow reads as "tomorrow" even though it's under 24 hours away.
 */
export function formatRelativeDay(date: Date, now = new Date()) {
  const days = zonedDayDiff(date, now);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 7) {
    return `on ${date.toLocaleDateString("en-US", { timeZone: EVENT_TIME_ZONE, weekday: "long" })}`;
  }
  return `on ${formatMonthDay(date)}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago", then a date for anything older than a week. */
export function formatTimeAgo(date: Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatMonthDay(date);
}
