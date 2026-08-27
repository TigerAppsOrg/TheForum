"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "~/components/common/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export interface Attendee {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * "N attending" — click to see who.
 *
 * The count was previously plain text, so the attendee data already being
 * fetched had nowhere to surface beyond a truncated avatar stack.
 */
export function AttendeesDialog({
  attendees,
  count,
  friendIds,
  className,
}: {
  attendees: Attendee[];
  /** Total RSVP count, which can exceed the attendees actually loaded. */
  count: number;
  /** Ids to badge as friends, so you can spot people you know. */
  friendIds?: Set<string>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const label = `${count} attending`;

  // Nothing to reveal — render plain text rather than a button that opens an
  // empty dialog.
  if (attendees.length === 0) {
    return (
      <span className={cn("font-dm-sans text-[14px] font-bold text-black", className)}>
        {label}
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "font-dm-sans text-[14px] font-bold text-black underline-offset-2 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
            className,
          )}
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Who&apos;s attending</DialogTitle>
          <DialogDescription>
            {count} {count === 1 ? "person has" : "people have"} RSVP&apos;d to this event.
          </DialogDescription>
        </DialogHeader>

        {attendees.length === 0 ? (
          <EmptyState icon={Users} title="No one yet" />
        ) : (
          <ul className="flex flex-col gap-1">
            {attendees.map((person) => (
              <li key={person.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forum-turquoise/40 font-dm-sans text-[12px] font-bold text-black"
                  >
                    {person.displayName[0]?.toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-dm-sans text-[14px] text-black">
                  {person.displayName}
                </span>
                {friendIds?.has(person.id) && (
                  <span className="shrink-0 rounded-full bg-forum-turquoise-20 px-2 py-0.5 font-dm-sans text-[11px] font-bold text-forum-cerulean">
                    Friend
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/*
          The attendee list can be shorter than the RSVP count — the server
          returns a capped sample — so say so instead of silently under-reporting.
        */}
        {count > attendees.length && (
          <p className="font-dm-sans text-[12px] text-forum-light-gray">
            and {count - attendees.length} more
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
