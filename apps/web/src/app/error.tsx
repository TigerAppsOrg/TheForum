"use client";

import Link from "next/link";
import { ErrorState } from "~/components/common/states";

/**
 * Catches errors outside the signed-in shell (landing, legal pages). Errors
 * inside the app are handled by (app)/error.tsx so the nav stays visible.
 */
export default function RootError({
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-forum-yellow-10 px-6 font-dm-sans">
      <ErrorState
        title="Something went wrong"
        description="We couldn't load this page. Please try again in a moment."
        onRetry={reset}
      />
      <Link href="/" className="text-[13px] font-medium text-forum-cerulean hover:underline">
        Back to The Forum
      </Link>
    </main>
  );
}
