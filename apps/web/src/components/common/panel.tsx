import { type VariantProps, cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Standard content surface.
 *
 * Distinct from `components/ui/card.tsx` (the shadcn card, which owns its own
 * 24px header/content/footer grid) and from the `.card` utility in globals.css
 * (reserved for the event card silhouette). `Panel` is the plain sectioned
 * container the app pages actually reach for — settings blocks, the Explore
 * right rail, the map's floating overlays.
 *
 * Padding steps with `size` rather than being respecified per page; the border
 * and radius are fixed so panels never disagree corner-to-corner.
 */
const panelVariants = cva("rounded-xl border border-forum-border bg-white", {
  variants: {
    size: {
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
      /** No padding — the panel's child manages it (e.g. a full-bleed map). */
      none: "p-0",
    },
    elevation: {
      flat: "",
      raised: "shadow-sm",
      /** Overlay sitting on top of the map. */
      floating: "border-white/60 bg-white/95 shadow-lg backdrop-blur-sm",
    },
  },
  defaultVariants: {
    size: "md",
    elevation: "raised",
  },
});

export function Panel({
  className,
  size,
  elevation,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof panelVariants> & {
    /** Render the panel styling onto the child (e.g. a whole-card `<Link>`). */
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "div";

  return (
    <Comp
      data-slot="panel"
      className={cn(panelVariants({ size, elevation, className }))}
      {...props}
    />
  );
}

/**
 * Heading row inside a `Panel` — title on the left, optional control on the
 * right, consistent 12px gap to the panel body.
 */
export function PanelHeader({
  className,
  title,
  description,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn("mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1", className)}
      {...props}
    >
      <div className="min-w-0">
        <h3 className="font-serif text-[18px] font-bold text-black">{title}</h3>
        {description ? (
          <p className="mt-0.5 font-dm-sans text-[13px] text-forum-light-gray">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { panelVariants };
