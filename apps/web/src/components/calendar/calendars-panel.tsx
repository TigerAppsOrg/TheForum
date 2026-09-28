"use client";

import { CalendarPlus, Copy, Download, Link2, MoreHorizontal, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type CalendarId, type MyCalendars, resetCalendarLink } from "~/actions/calendar";
import { OrgAvatar } from "~/components/common/org-avatar";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/** https://… feed → webcal://… (opens the OS calendar app's subscribe flow). */
export function toWebcal(feedUrl: string) {
  return feedUrl.replace(/^https?:\/\//, "webcal://");
}

/** Google Calendar "add by URL" link for a webcal feed. */
export function googleSubscribeUrl(feedUrl: string) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(toWebcal(feedUrl))}`;
}

function ExportMenu({ name, feedUrl }: { name: string; feedUrl: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toWebcal(feedUrl));
      toast.success("Subscription link copied", {
        description: "Paste it into any calendar app's “subscribe by URL”.",
      });
    } catch {
      toast.message(toWebcal(feedUrl));
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Export ${name}`}
          className="shrink-0 text-forum-light-gray hover:text-black"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 font-dm-sans">
        <DropdownMenuLabel className="truncate text-[12px] text-forum-light-gray">
          {name}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={googleSubscribeUrl(feedUrl)} target="_blank" rel="noopener noreferrer">
            <CalendarPlus aria-hidden />
            Add to Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={toWebcal(feedUrl)}>
            <Link2 aria-hidden />
            Subscribe (Apple / Outlook)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copy}>
          <Copy aria-hidden />
          Copy subscription link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`${feedUrl}?download=1`} download>
            <Download aria-hidden />
            Download .ics
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The "Calendars" panel: toggle each calendar's visibility in the view, and
 * export any of them (subscribe via webcal / Google, copy link, download .ics),
 * plus a combined feed. Feed URLs are secret; "Reset link" rotates them.
 */
export function CalendarsPanel({
  data,
  colors,
  hidden,
  onToggle,
  onReset,
}: {
  data: MyCalendars;
  colors: Map<CalendarId, string>;
  hidden: Set<CalendarId>;
  onToggle: (id: CalendarId) => void;
  /** Called after the link was rotated, to reload feed URLs. */
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, startReset] = useTransition();
  const mine = data.calendars.filter((c) => c.kind !== "org");
  const followed = data.calendars.filter((c) => c.kind === "org" && c.followed);
  const suggested = data.calendars.filter((c) => c.kind === "org" && !c.followed);

  const row = (c: MyCalendars["calendars"][number]) => {
    const visible = !hidden.has(c.id);
    const color = colors.get(c.id) ?? "#64748b";
    return (
      <li key={c.id} className="flex items-center gap-2 py-1">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={visible}
            onChange={() => onToggle(c.id)}
            className="size-4 shrink-0 rounded"
            style={{ accentColor: color }}
          />
          {c.kind === "org" ? (
            <OrgAvatar name={c.name} logoUrl={c.logoUrl} size={20} />
          ) : (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: color }}
            />
          )}
          <span className="min-w-0 truncate font-dm-sans text-[13px] text-black">{c.name}</span>
          {c.kind === "org" && (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: color }}
            />
          )}
        </label>
        <ExportMenu name={c.name} feedUrl={c.feedUrl} />
      </li>
    );
  };

  return (
    <aside
      aria-label="Calendars"
      className="flex h-fit flex-col gap-4 rounded-[24px] border border-forum-border bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-dm-sans text-[13px] font-semibold text-black">Calendars</h2>
      </div>

      <ul>{mine.map(row)}</ul>

      <div>
        <p className="mb-1 font-dm-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-forum-light-gray">
          Organizations you follow
        </p>
        {followed.length > 0 ? (
          <ul>{followed.map(row)}</ul>
        ) : (
          <p className="font-dm-sans text-[12px] text-forum-light-gray">
            Follow an organization to get a calendar of all its events.
          </p>
        )}
      </div>

      {suggested.length > 0 && (
        <div>
          <p className="mb-1 font-dm-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-forum-light-gray">
            From your RSVPs &amp; saves
          </p>
          <ul>{suggested.map(row)}</ul>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl bg-forum-turquoise-20 px-3 py-2.5">
        <div className="min-w-0 flex-1 font-dm-sans">
          <p className="text-[13px] font-semibold text-black">All my Forum events</p>
          <p className="text-[11px] text-forum-dark-gray">
            Going, saved and followed orgs in one feed
          </p>
        </div>
        <ExportMenu name="All my Forum events" feedUrl={data.allFeedUrl} />
      </div>

      <p className="font-dm-sans text-[11px] leading-snug text-forum-light-gray">
        Subscription links are private — anyone with one can see those events.{" "}
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-1 font-medium text-forum-cerulean hover:underline"
        >
          <RefreshCw size={11} aria-hidden />
          Reset link
        </button>
      </p>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset your calendar links?</DialogTitle>
            <DialogDescription>
              Every subscription you've added (Google, Apple, Outlook) stops updating. You'll need
              to subscribe again with the new links.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="coral"
              disabled={isResetting}
              onClick={() =>
                startReset(async () => {
                  try {
                    await resetCalendarLink();
                    setConfirmReset(false);
                    toast.success("Calendar links reset");
                    onReset();
                  } catch {
                    toast.error("Couldn't reset the links. Please try again.");
                  }
                })
              }
            >
              {isResetting ? "Resetting…" : "Reset links"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
