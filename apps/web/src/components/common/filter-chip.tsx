"use client";

import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Toggleable filter chip.
 *
 * Every filtered surface previously rolled its own pill: Explore used
 * `rounded-full px-[14px] h-[30px]` with a cerulean fill, the map's filter
 * pills used `rounded-[20px] h-[32px]` with a turquoise fill, My Events used
 * square-ish tabs, and Orgs used a bordered pill. They now share one shape,
 * one type scale, and one selected treatment.
 *
 * Selection is communicated with `aria-pressed`, not colour alone.
 */
const filterChipVariants = cva(
  cn(
    "inline-flex h-[32px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full",
    "px-[14px] font-dm-sans text-[13px] font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  ),
  {
    variants: {
      active: {
        true: "bg-forum-cerulean text-white",
        false:
          "border border-forum-border bg-white text-forum-dark-gray hover:border-forum-cerulean hover:text-black",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export function FilterChip({
  className,
  active = false,
  type = "button",
  ...props
}: Omit<React.ComponentProps<"button">, "aria-pressed"> & VariantProps<typeof filterChipVariants>) {
  return (
    <button
      type={type}
      data-slot="filter-chip"
      aria-pressed={active ?? false}
      className={cn(filterChipVariants({ active, className }))}
      {...props}
    />
  );
}

/**
 * Horizontal chip row. Scrolls rather than wrapping on narrow viewports.
 *
 * A `<fieldset>` + visually-hidden `<legend>` rather than `role="group"` +
 * `aria-label` — same semantics, but it survives Biome's `useSemanticElements`
 * rule and needs no ARIA to carry the group name.
 */
export function FilterChipGroup({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<"fieldset"> & { label: string }) {
  return (
    <fieldset
      data-slot="filter-chip-group"
      className={cn("scrollbar-cerulean flex items-center gap-2 overflow-x-auto pb-1", className)}
      {...props}
    >
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  );
}

export { filterChipVariants };
