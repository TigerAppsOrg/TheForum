import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Standard page container. Owns the horizontal gutter and max width for every
 * routed page so individual pages stop hand-rolling `px-[40px] max-w-4xl`.
 *
 * Gutters step up with the viewport (20 → 32 → 40px) so the sidebar-adjacent
 * content never crowds the edge on tablet.
 */
const pageShellVariants = cva("mx-auto w-full px-5 py-6 sm:px-8 lg:px-10 lg:py-8", {
  variants: {
    width: {
      /** Forms, settings, single-column reading. */
      narrow: "max-w-3xl",
      /** Default: list + detail pages. */
      content: "max-w-5xl",
      /** Multi-column dashboards (Explore). */
      wide: "max-w-7xl",
      /** Opt out — the page manages its own width (e.g. full-bleed map). */
      full: "max-w-none",
    },
  },
  defaultVariants: {
    width: "content",
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
 * Page-level `<h1>`. One ramp for every page — previously these ranged from
 * 48px to 60px with no rhyme, and none of them scaled down on mobile.
 */
export function PageHeading({
  className,
  children,
  description,
  action,
  ...props
}: React.ComponentProps<"h1"> & {
  /** Optional supporting line rendered under the title. */
  description?: React.ReactNode;
  /** Optional trailing control (button, link) aligned to the title baseline. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
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
