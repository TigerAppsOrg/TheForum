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
