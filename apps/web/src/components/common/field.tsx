import type * as React from "react";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

/**
 * Labelled form field with hint and error slots.
 *
 * The create-org, create-event and edit-event forms each repeated this
 * label/control/error stack with their own type scale and error colour
 * (`text-red-400` in one, `text-forum-coral` in another). One field now.
 *
 * The error is wired to the control with `aria-describedby`, so pass the same
 * `id` you give the input — screen readers announce the message with the field
 * rather than leaving it as loose text.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "id"> & {
  /** Must match the `id` of the control rendered as `children`. */
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-2", className)} {...props}>
      <Label htmlFor={id} className="font-dm-sans text-sm font-semibold text-black">
        {label}
        {required ? (
          <span aria-hidden className="text-forum-coral">
            *
          </span>
        ) : null}
      </Label>
      {hint ? <p className="font-dm-sans text-xs text-forum-light-gray">{hint}</p> : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="font-dm-sans text-xs text-forum-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Props to spread onto the control inside a `Field` so errors are announced. */
export function fieldControlProps(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}
