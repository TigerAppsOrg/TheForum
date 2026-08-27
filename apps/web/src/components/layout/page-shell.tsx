import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Standard page container. Owns the horizontal gutter and max width for every
 * routed page so individual pages stop hand-rolling `px-[40px] max-w-4xl`.
 *
 * Gutters step up with the viewport (20 → 32 → 40px) so the sidebar-adjacent
 * content never crowds the edge on tablet.
 *
 * Deliberately **left-aligned, not centred**. `max-w-*` differs per page, so
 * centring with `mx-auto` produced a different left edge on every route: the
 * wide Explore feed sat flush against the gutter while the narrower Events page
 * was pushed inward by half the leftover width, and the two page titles did not
 * line up. Left-aligning means the distance from the rail to the heading is the
 * same on every page at every viewport, and `max-w-*` now only caps line length
 * on the right.
 */
const pageShellVariants = cva("w-full px-5 py-6 sm:px-8 lg:px-10 lg:py-8", {
  variants: {
    width: {
      /** Forms only — keeps inputs and prose at a readable measure. */
      narrow: "max-w-3xl",
      /** Slightly tighter than the default; single-column reading. */
      content: "max-w-5xl",
      /** Default: matches Explore, so list pages agree with the home screen. */
      wide: "max-w-7xl",
      /** Opt out — the page manages its own width (e.g. full-bleed map). */
      full: "max-w-none",
    },
  },
  /*
   * `wide` is the default so every list page spans the same width as the home
   * screen. Previously the default was `content` (max-w-5xl), which left the
   * Events and Friends tab bars 256px shorter than the Explore column and made
   * them read as mis-centred against it.
   */
  defaultVariants: {
    width: "wide",
  },
});

export function PageShell({
  className,
  width,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof pageShellVariants>) {
  return (
    <div
      data-slot="page-shell"
      className={cn(pageShellVariants({ width, className }))}
      {...props}
    />
  );
}

/**
 * Right padding that keeps a page's top-right control clear of the TopBar.
 *
 * The TopBar (notification bell + avatar) is absolutely positioned over the
 * content area on every route, so anything sharing that band — a page heading's
 * trailing action — collides with it once the viewport is narrower than the
 * shell's max width. Roughly 24px page padding + 36px bell + 12px gap + 40px
 * avatar + 24px padding, rounded up.
 */
export const TOP_BAR_CLEARANCE = "pr-[140px]";

/**
 * Page-level `<h1>`. One ramp for every page — previously these ranged from
 * 48px to 60px with no rhyme, and none of them scaled down on mobile.
 */
export function PageHeading({
  className,
  children,
  description,
  action,
  clearTopBar = false,
  ...props
}: React.ComponentProps<"h1"> & {
  /** Optional supporting line rendered under the title. */
  description?: React.ReactNode;
  /** Optional trailing control (button, link) aligned to the title baseline. */
  action?: React.ReactNode;
  /**
   * Reserve room for the floating TopBar. Set this when the heading is the
   * first thing on the page *and* carries an `action`, so the two don't
   * overlap. Off by default — headings rendered further down the page (an org
   * profile's title inside its panel) sit below the TopBar already.
   */
  clearTopBar?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        clearTopBar && TOP_BAR_CLEARANCE,
      )}
    >
      <div className="min-w-0">
        <h1
          data-slot="page-heading"
          className={cn(
            "font-serif text-[34px] leading-none text-black sm:text-[44px] lg:text-[52px]",
            className,
          )}
          {...props}
        >
          {children}
        </h1>
        {description ? (
          <p className="mt-2 font-dm-sans text-[14px] text-forum-light-gray">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Section heading with the cerulean dot used across Explore and the org pages. */
export function SectionHeading({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span aria-hidden className="size-[11px] shrink-0 rounded-full bg-forum-cerulean" />
      <h2
        data-slot="section-heading"
        className={cn("font-serif text-[18px] font-bold text-black", className)}
        {...props}
      >
        {children}
      </h2>
    </div>
  );
}

export { pageShellVariants };
