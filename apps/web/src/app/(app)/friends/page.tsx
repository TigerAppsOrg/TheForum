import { getFriends, getPendingRequests } from "~/actions/friends";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { FriendsClient } from "./friends-client";

export default async function FriendsPage() {
  const [friends, pending] = await Promise.all([getFriends(), getPendingRequests()]);

  return (
    <PageShell>
      <PageHeading>My Friends</PageHeading>
      <FriendsClient initialFriends={friends} initialPending={pending} />
    </PageShell>
  );
}
