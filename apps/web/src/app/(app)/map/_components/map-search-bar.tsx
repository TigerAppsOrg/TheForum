"use client";

import { SearchInput } from "~/components/common/search-input";

interface MapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function MapSearchBar({ value, onChange }: MapSearchBarProps) {
  return (
    <SearchInput
      label="Find events on the map"
      placeholder="Find events"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // Floats over the map — needs the translucent backdrop the docked field doesn't.
      className="bg-white/95 shadow-lg shadow-black/5 backdrop-blur-sm"
    />
  );
}
