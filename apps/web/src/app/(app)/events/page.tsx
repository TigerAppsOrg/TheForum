import { getFriendsEvents, getMyEvents } from "~/actions/events";
import { MyEventsClient } from "./my-events-client";

export default async function MyEventsPage() {
  const { rsvped, saved } = await getMyEvents();
  const friends = await getFriendsEvents();

  return <MyEventsClient rsvped={rsvped} saved={saved} friends={friends} />;
}
