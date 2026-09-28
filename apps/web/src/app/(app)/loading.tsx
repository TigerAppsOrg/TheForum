import { EventCardSkeletonList } from "~/components/common/states";
import { PageShell } from "~/components/layout/page-shell";
import { Skeleton } from "~/components/ui/skeleton";

/** Shown inside the app shell while a route's server data loads. */
export default function AppLoading() {
  return (
    <PageShell>
      <Skeleton className="mb-3 h-10 w-64 sm:h-12" />
      <Skeleton className="mb-8 h-4 w-48" />
      <EventCardSkeletonList count={4} />
    </PageShell>
  );
}
