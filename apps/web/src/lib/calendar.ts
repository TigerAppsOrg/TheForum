import { eventEndOrDefault, eventLocationText, formatIcsDate } from "~/lib/ics";

/**
 * Google Calendar "add event" link for a single event.
 *
 * Shares its rules with the iCalendar feeds (`lib/ics.ts`): UTC timestamps,
 * a one-hour default when there's no end, and "Venue, Room" locations — so an
 * event reads the same whether it's added one-off or via a subscription.
 */
export function buildGCalUrl(event: {
  title: string;
  description: string | null;
  datetime: Date;
  endDatetime: Date | null;
  locationName: string | null;
  locationDetail?: string | null;
  /** Absolute event URL, appended to the details. */
  url?: string | null;
}) {
  const start = formatIcsDate(event.datetime);
  const end = formatIcsDate(eventEndOrDefault(event.datetime, event.endDatetime));
  const details = [event.description?.trim(), event.url].filter(Boolean).join("\n\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details,
    location: eventLocationText(event.locationName, event.locationDetail),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
