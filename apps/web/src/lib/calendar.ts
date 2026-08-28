/**
 * Google Calendar "add event" link.
 *
 * Lived inside the event detail page; the map's event modal needs the same
 * "+ Calendar" action, so it moved here rather than being written twice.
 */
export function buildGCalUrl(event: {
  title: string;
  description: string | null;
  datetime: Date;
  endDatetime: Date | null;
  locationName: string | null;
}) {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const start = fmt(event.datetime);
  // Default to a one-hour block when the event has no explicit end.
  const end = fmt(event.endDatetime ?? new Date(event.datetime.getTime() + 60 * 60 * 1000));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description ?? "",
    location: event.locationName ?? "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
