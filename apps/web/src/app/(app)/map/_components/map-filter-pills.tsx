"use client";

import { Heart, Users, Zap } from "lucide-react";
import { FilterChip } from "~/components/common/filter-chip";
import type { FilterKey } from "../map-client";

interface MapFilterPillsProps {
  activeFilters: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
}

const PILLS: { key: FilterKey; label: string; icon: typeof Users }[] = [
  { key: "friends", label: "Find Your Friends", icon: Users },
  { key: "now", label: "Happening Now", icon: Zap },
  { key: "attending", label: "Events You're Attending", icon: Heart },
];

export function MapFilterPills({ activeFilters, onToggle }: MapFilterPillsProps) {
  return (
    <fieldset className="flex flex-wrap items-center justify-center gap-2">
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
