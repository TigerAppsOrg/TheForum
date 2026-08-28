import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import type * as React from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

/**
 * Shared empty / loading / error states.
 *
 * Every page previously hand-rolled these with slightly different padding
 * (`py-[60px]` vs `py-20`), type scale (22 / 24 / base) and colour. These three
 * components are the only ones that should be used going forward.
 */

const SHELL = "flex flex-col items-center justify-center px-6 py-16 text-center";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div data-slot="empty-state" className={cn(SHELL, className)} {...props}>
      <Icon size={26} aria-hidden className="mb-3 text-forum-medium-gray" />
      <p className="font-serif text-[22px] text-forum-dark-gray">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm font-dm-sans text-[13px] text-forum-light-gray">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** When provided, renders a Try again button. */
  onRetry?: () => void;
}) {
  return (
    <div data-slot="error-state" role="alert" className={cn(SHELL, className)} {...props}>
      <AlertTriangle size={26} aria-hidden className="mb-3 text-forum-coral" />
      <p className="font-serif text-[22px] text-forum-dark-gray">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm font-dm-sans text-[13px] text-forum-light-gray">
          {description}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5 rounded-full" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Text-only loading state, for regions too small to justify a skeleton. */
export function LoadingState({
  label = "Loading…",
  className,
  ...props
}: React.ComponentProps<"output"> & { label?: string }) {
  // <output> carries an implicit role="status" + polite live region.
  return (
    <output data-slot="loading-state" className={cn(SHELL, className)} {...props}>
      <p className="font-serif text-[22px] text-forum-dark-gray">{label}</p>
    </output>
  );
}

/** Matches the EventCard silhouette so the feed doesn't jump when data lands. */
export function EventCardSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-card-skeleton"
      aria-hidden
      className={cn("card flex flex-col gap-4 rounded-xl p-5", className)}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="size-4 rounded" />
        </div>
        <Skeleton className="size-4 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-[10px]" />
        <Skeleton className="h-5 w-14 rounded-[10px]" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="ml-auto h-8 w-20 rounded-md" />
    </div>
  );
}

export function EventCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <output className="flex flex-col gap-5">
      <span className="sr-only">Loading events…</span>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder list
        <EventCardSkeleton key={i} />
      ))}
    </output>
  );
}
