import { getFeedEvents, getFriendsEvents, getSavedEvents } from "~/actions/events";
import { auth } from "~/auth";
import { ExploreClient } from "./explore-client";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;

  const [feedResult, savedEvents, friendsEvents, session] = await Promise.all([
    getFeedEvents(search ? { search } : undefined),
    getSavedEvents(),
    getFriendsEvents(),
    auth(),
  ]);

  return (
    <ExploreClient
      initialEvents={feedResult.events}
      initialTotal={feedResult.total}
      initialAsOf={feedResult.asOf}
      savedEvents={savedEvents}
      friendsEvents={friendsEvents}
      initialSearch={search ?? ""}
      userName={session?.user?.name ?? "there"}
      userAvatarUrl={session?.user?.image ?? null}
    />
  );
}
