import { type VariantProps, cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",

        /*
         * Forum variants. The app's real button languages, which previously
         * lived as ~90 hand-rolled `<button className="h-[42px] bg-black …">`
         * elements across the (app) routes. Radius is `rounded-lg` (10px, the
         * --radius token) so every button agrees with the card corner.
         */
        /** Primary action: RSVP, Save, Create. Forum cerulean, #0A9CD5. */
        cerulean: "rounded-lg bg-forum-cerulean text-white shadow-sm hover:bg-forum-cerulean/90",
        /** High-contrast action on tinted surfaces. */
        solid: "rounded-lg bg-black text-white hover:bg-forum-dark-gray",
        /** Destructive / leave / remove. */
        coral: "rounded-lg bg-forum-coral text-white hover:bg-forum-coral/90",
        /** Secondary action sitting on white. */
        soft: "rounded-lg bg-forum-turquoise-20 text-black hover:bg-forum-turquoise/40",
        /** Tertiary, de-emphasized action. */
        quiet: "rounded-lg text-forum-light-gray hover:bg-forum-turquoise/20 hover:text-black",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        /** Forum call-to-action: uppercase, tracked, 42px tall. */
        cta: "h-[42px] rounded-lg px-8 font-dm-sans text-[13px] font-bold tracking-[0.08em] uppercase has-[>svg]:px-6",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
