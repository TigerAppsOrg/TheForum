const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

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

/**
 * "today" / "tomorrow" / "on Fri, Mar 3" — for sentences like
 * "TigerApps Social is happening tomorrow!".
 *
 * Compares calendar days rather than elapsed hours, so an event at 9am
 * tomorrow reads as "tomorrow" even though it's under 24 hours away.
 */
export function formatRelativeDay(date: Date, now = new Date()) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 7) {
    return `on ${date.toLocaleDateString("en-US", { weekday: "long" })}`;
  }
  return `on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
