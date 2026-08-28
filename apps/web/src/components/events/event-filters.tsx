"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { FilterChip } from "~/components/common/filter-chip";
import { Button } from "~/components/ui/button";

const QUICK_FILTERS = [
  { id: "free food", label: "free food" },
  { id: "tech", label: "tech talk" },
  { id: "career", label: "career" },
  { id: "social event", label: "social" },
  { id: "music", label: "music" },
  { id: "visual arts", label: "art" },
  { id: "athletics", label: "sports" },
] as const;

const ALL_FILTERS = [
  ...QUICK_FILTERS,
  { id: "academics", label: "academics" },
  { id: "culture", label: "culture" },
  { id: "performing arts", label: "performing arts" },
  { id: "speaker event", label: "speaker" },
  { id: "research", label: "research" },
  { id: "entrepreneurship", label: "entrepreneurship" },
  { id: "stem", label: "stem" },
  { id: "literature", label: "literature" },
  { id: "wellness", label: "wellness" },
  { id: "outdoors", label: "outdoors" },
  { id: "sustainability", label: "sustainability" },
  { id: "gaming", label: "gaming" },
  { id: "community service", label: "service" },
  { id: "religion", label: "religion" },
  { id: "politics", label: "politics" },
] as const;

interface EventFiltersProps {
  activeFilters: string[];
  onFilterToggle: (filterId: string) => void;
}

export function EventFilters({ activeFilters, onFilterToggle }: EventFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const filters = expanded ? ALL_FILTERS : QUICK_FILTERS;

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Filter events by tag</legend>
      {filters.map(({ id, label }) => (
        <FilterChip key={id} active={activeFilters.includes(id)} onClick={() => onFilterToggle(id)}>
          {label}
        </FilterChip>
      ))}
      <Button
        variant="quiet"
        size="sm"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <Pencil />
        {expanded ? "Less" : "Edit filters"}
      </Button>
    </fieldset>
  );
}
