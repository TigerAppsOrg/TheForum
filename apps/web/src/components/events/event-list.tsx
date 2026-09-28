import type * as React from "react";
import { cn } from "~/lib/utils";

/**
 * Bordered, hairline-divided container for `EventCard density="row"` items —
 * the one list look shared by Explore and My Events.
 */
export function EventList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-list"
      className={cn(
        "divide-y divide-forum-border overflow-hidden rounded-lg border border-forum-border bg-white",
        className,
      )}
      {...props}
    />
  );
}
