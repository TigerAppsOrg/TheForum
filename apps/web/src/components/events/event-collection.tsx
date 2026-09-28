"use client";

import { LayoutGrid, List } from "lucide-react";
import type * as React from "react";
import { EventList } from "~/components/events/event-list";
import type { EventView } from "~/lib/use-event-view";
import { cn } from "~/lib/utils";

/** Segmented Cards / List switch. */
export function EventViewToggle({
  view,
  onChange,
  className,
}: {
  view: EventView;
  onChange: (view: EventView) => void;
  className?: string;
}) {
  const options = [
    { id: "cards" as const, label: "Cards", icon: LayoutGrid },
    { id: "rows" as const, label: "List", icon: List },
  ];
  return (
    <fieldset
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-forum-border bg-white p-0.5",
        className,
      )}
    >
      <legend className="sr-only">Event layout</legend>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          aria-label={`${label} view`}
          title={`${label} view`}
          onClick={() => onChange(id)}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full px-2.5 font-dm-sans text-[12px] font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
            view === id
              ? "bg-forum-turquoise/60 text-black"
              : "text-forum-light-gray hover:text-black",
          )}
        >
          <Icon size={13} aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </fieldset>
  );
}

/**
 * Lays out events as a card grid (two columns on wide screens) or as a dense
 * divided list. `renderItem` receives the matching EventCard density.
 */
export function EventCollection<T extends { id: string }>({
  items,
  view,
  renderItem,
  className,
}: {
  items: T[];
  view: EventView;
  renderItem: (item: T, index: number, density: "default" | "row") => React.ReactNode;
  className?: string;
}) {
  if (view === "rows") {
    return (
      <EventList className={className}>
        {items.map((item, index) => renderItem(item, index, "row"))}
      </EventList>
    );
  }
  return (
    <div className={cn("grid items-stretch gap-4 md:grid-cols-2", className)}>
      {items.map((item, index) => renderItem(item, index, "default"))}
    </div>
  );
}
