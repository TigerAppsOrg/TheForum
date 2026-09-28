import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCampusLocations, getEvent } from "~/actions/events";
import { EditEventForm } from "./edit-event-form";

export const metadata: Metadata = { title: "Edit Event" };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, locations] = await Promise.all([getEvent(id), getCampusLocations()]);

  if (!event) notFound();
  if (!event.isOwner) redirect(`/events/${id}`);

  return <EditEventForm event={event} locations={locations} />;
}
