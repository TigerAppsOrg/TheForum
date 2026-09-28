import type { Metadata } from "next";
import { getCampusLocations } from "~/actions/events";
import { getUserOrgs } from "~/actions/orgs";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Create an Event" };

export default async function CreateEventPage() {
  const [locations, userOrgs] = await Promise.all([getCampusLocations(), getUserOrgs()]);

  return <CreateEventForm locations={locations} userOrgs={userOrgs} />;
}
