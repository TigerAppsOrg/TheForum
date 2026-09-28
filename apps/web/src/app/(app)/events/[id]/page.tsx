import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getEvent, getSimilarEvents } from "~/actions/events";
import { EventDetailClient } from "./event-detail-client";

// Deduped per request so the title and the page share one query.
const loadEvent = cache(getEvent);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await loadEvent(id).catch(() => null);
  return { title: event?.title ?? "Event" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await loadEvent(id);

  if (!event) notFound();

  const similarEvents = await getSimilarEvents(id, event.tags, event.orgId);

  return <EventDetailClient event={event} similarEvents={similarEvents} />;
}
