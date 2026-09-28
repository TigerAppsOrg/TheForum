import { getFeedEvents, getFriendsEvents, getSavedEvents } from "~/actions/events";
import { getGreetingName } from "~/actions/users";
import { auth } from "~/auth";
import { DEFAULT_FEED_SORT } from "~/lib/feed-ranking";
import { feedSortSchema } from "~/lib/validation";
import { ExploreClient } from "./explore-client";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: string | string[] }>;
}) {
  const { search, sort: sortParam } = await searchParams;
  // An unknown or repeated `?sort=` falls back to the default rather than erroring.
  const parsedSort = feedSortSchema.safeParse(sortParam);
  const sort = parsedSort.success ? parsedSort.data : DEFAULT_FEED_SORT;

  const [feedResult, savedEvents, friendsEvents, session, greetingName] = await Promise.all([
    getFeedEvents({ search: search || undefined, sort }),
    getSavedEvents(),
    getFriendsEvents(),
    auth(),
    getGreetingName(),
  ]);

  return (
    <ExploreClient
      initialEvents={feedResult.events}
      initialTotal={feedResult.total}
      initialNextOffset={feedResult.nextOffset}
      initialRemaining={feedResult.remaining}
      initialAsOf={feedResult.asOf}
      initialSort={sort}
      sortFromUrl={parsedSort.success}
      savedEvents={savedEvents}
      friendsEvents={friendsEvents}
      initialSearch={search ?? ""}
      greetingName={greetingName}
      userAvatarUrl={session?.user?.image ?? null}
    />
  );
}
