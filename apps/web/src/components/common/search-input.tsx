"use client";

import { Search } from "lucide-react";
import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Standard search field.
 *
 * Explore used a 36px bordered box with a sentence-case placeholder; Friends
 * used a 42px tinted box with a heavy drop shadow and an ALL-CAPS placeholder.
 * One field now, with the icon inside the control and the border reacting to
 * focus rather than a shadow.
 *
 * `label` is required and rendered visually hidden — a placeholder is not an
 * accessible name.
 */
export function SearchInput({
  className,
  label,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <div
      className={cn(
        "flex h-[40px] items-center gap-2 rounded-lg border border-forum-border bg-white px-3.5",
        "transition-colors focus-within:border-forum-cerulean",
        className,
      )}
    >
      <Search size={15} aria-hidden className="shrink-0 text-forum-placeholder" />
      <input
        type="search"
        aria-label={label}
        className={cn(
          "min-w-0 flex-1 bg-transparent font-dm-sans text-[14px] text-black outline-none",
          "placeholder:text-forum-placeholder",
          // Hide WebKit's built-in clear affordance; it clashes with the border.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
        {...props}
      />
    </div>
  );
}
