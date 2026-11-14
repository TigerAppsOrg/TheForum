import type { Metadata } from "next";
import { getCampusLocations } from "~/actions/events";
import { getOrgOptions } from "~/actions/orgs";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Create an Event" };

export default async function CreateEventPage() {
  const [locations, orgs] = await Promise.all([getCampusLocations(), getOrgOptions()]);

  return <CreateEventForm locations={locations} orgs={orgs} />;
}
