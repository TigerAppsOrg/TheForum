"use client";

import Link from "next/link";
import { ErrorState } from "~/components/common/states";
import { PageShell } from "~/components/layout/page-shell";

/** In-app error boundary: keeps the nav rail and top bar around the failure. */
export default function AppError({
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageShell className="flex min-h-[60dvh] flex-col items-center justify-center">
      <ErrorState
        title="Something went wrong"
        description="This page couldn't load. Check your connection and try again."
        onRetry={reset}
      />
      <Link
        href="/explore"
        className="font-dm-sans text-[13px] font-medium text-forum-cerulean hover:underline"
      >
        Back to Explore
      </Link>
    </PageShell>
  );
}
