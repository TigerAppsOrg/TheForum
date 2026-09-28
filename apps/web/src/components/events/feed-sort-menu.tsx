"use client";

import { ArrowUpDown, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { FEED_SORTS, type FeedSort } from "~/lib/feed-ranking";
import { cn } from "~/lib/utils";

export const FEED_SORT_LABELS: Record<FeedSort, { label: string; short: string; hint: string }> = {
  foryou: { label: "For you", short: "For you", hint: "Ranked for you" },
  soonest: { label: "Soonest", short: "Soonest", hint: "Starting soonest first" },
  recent: { label: "Recently posted", short: "Recent", hint: "Newest announcements first" },
};

/** Compact sort picker that sits beside the Cards/List toggle on Home. */
export function FeedSortMenu({
  sort,
  onChange,
  className,
}: {
  sort: FeedSort;
  onChange: (sort: FeedSort) => void;
  className?: string;
}) {
  const current = FEED_SORT_LABELS[sort];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Sort events: ${current.label}`}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-forum-border bg-white px-3",
          "font-dm-sans text-[12px] font-medium text-black transition-colors hover:border-forum-coral",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
          className,
        )}
      >
        <ArrowUpDown size={13} aria-hidden className="text-forum-light-gray" />
        <span className="sm:hidden">{current.short}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={13} aria-hidden className="text-forum-light-gray" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 font-dm-sans">
        <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onChange(v as FeedSort)}>
          {FEED_SORTS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} className="flex-col items-start gap-0">
              <span className="text-[13px] font-medium">{FEED_SORT_LABELS[id].label}</span>
              <span className="text-[11px] text-forum-light-gray">{FEED_SORT_LABELS[id].hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
