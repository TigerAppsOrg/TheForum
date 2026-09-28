import { notFound, redirect } from "next/navigation";
import { getCampusLocations, getEvent } from "~/actions/events";
import { EditEventForm } from "./edit-event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, locations] = await Promise.all([getEvent(id), getCampusLocations()]);

  if (!event) notFound();
  // Creator, or an owner/officer of the event's org.
  if (!event.canEdit) redirect(`/events/${id}`);

  return <EditEventForm event={event} locations={locations} />;
}
