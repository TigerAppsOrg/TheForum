import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Standard page container: one gutter, one max width, centred under the
 * header. Kept tight on purpose — the app is a dense, search-first tool, not a
 * magazine layout.
 */
const pageShellVariants = cva("mx-auto w-full px-4 py-4 sm:px-6 sm:py-5", {
  variants: {
    width: {
      /** Forms and settings — a readable measure. */
      narrow: "max-w-2xl",
      /** Single-column reading, e.g. event detail. */
      content: "max-w-4xl",
      /** Default for list pages. */
      wide: "max-w-6xl",
      /** Opt out — the page manages its own width (e.g. full-bleed map). */
      full: "max-w-none",
    },
  },
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
 * Page-level `<h1>`: small, with an optional one-line description and a
 * trailing action on the same row.
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
  /** Optional trailing control (button, link) aligned with the title. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1
          data-slot="page-heading"
          className={cn(
            "font-serif text-[22px] font-semibold leading-tight text-black sm:text-[24px]",
            className,
          )}
          {...props}
        >
          {children}
        </h1>
        {description ? (
          <p className="mt-0.5 font-dm-sans text-[13px] text-forum-light-gray">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Quiet section label — small caps, no decoration. */
export function SectionHeading({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="section-heading"
      className={cn(
        "mb-2 font-dm-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-forum-light-gray",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export { pageShellVariants };
