import { EventCardSkeletonList } from "~/components/common/states";
import { PageShell } from "~/components/layout/page-shell";
import { Skeleton } from "~/components/ui/skeleton";

/** Shown inside the app shell while a route's server data loads. */
export default function AppLoading() {
  return (
    <PageShell>
      <Skeleton className="mb-2 h-6 w-40" />
      <Skeleton className="mb-4 h-10 w-full" />
      <EventCardSkeletonList count={4} />
    </PageShell>
  );
}
