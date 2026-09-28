"use client";

import { Users, Zap } from "lucide-react";
import { FilterChip } from "~/components/common/filter-chip";
import type { FilterKey } from "../map-client";

interface MapFilterPillsProps {
  activeFilters: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
}

/*
 * "Events You're Attending" was dropped: map events don't carry the viewer's
 * RSVP state, so the pill could never filter anything. Friends Going filters
 * on the friend RSVPs each map event already includes.
 */
const PILLS: { key: FilterKey; label: string; icon: typeof Users }[] = [
  { key: "friends", label: "Friends Going", icon: Users },
  { key: "now", label: "Happening Now", icon: Zap },
];

export function MapFilterPills({ activeFilters, onToggle }: MapFilterPillsProps) {
  // Scrolls sideways on phones rather than wrapping into stacked rows that
  // eat the map.
  return (
    <fieldset className="scrollbar-cerulean flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0">
      <legend className="sr-only">Filter map events</legend>
      {PILLS.map(({ key, label, icon: Icon }) => (
        <FilterChip
          key={key}
          active={activeFilters.has(key)}
          onClick={() => onToggle(key)}
          // Sits over the map, so the inactive state needs a backdrop of its own.
          className="shadow-sm aria-[pressed=false]:bg-white/95 aria-[pressed=false]:backdrop-blur-sm"
        >
          <Icon aria-hidden />
          {label}
        </FilterChip>
      ))}
    </fieldset>
  );
}
