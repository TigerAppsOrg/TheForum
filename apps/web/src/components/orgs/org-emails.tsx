"use client";

import { ExternalLink, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { getInboxEmail } from "~/actions/inbox";
import { RichText } from "~/components/common/rich-text";
import { LoadingState } from "~/components/common/states";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { EVENT_TIME_ZONE, getZonedParts, zonedDayDiff } from "~/lib/date-format";
import type { InboxMessage, InboxMessageDetail } from "~/lib/inbox-engine";
import { cn } from "~/lib/utils";

/** Inbox-style date, in Princeton time: "3:04 PM" today, "Tue" this week, else "Sep 12" / "Sep 12, 2024". */
function formatSentAt(iso: string) {
  const date = new Date(iso);
  const daysAgo = -zonedDayDiff(date);
  const sameYear = getZonedParts(date).year === getZonedParts(new Date()).year;
  const opts: Intl.DateTimeFormatOptions =
    daysAgo === 0
      ? { hour: "numeric", minute: "2-digit" }
      : daysAgo > 0 && daysAgo < 7
        ? { weekday: "short" }
        : sameYear
          ? { month: "short", day: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleString("en-US", { timeZone: EVENT_TIME_ZONE, ...opts });
}

/** "Sep 28, 2026, 10:41 PM" in Princeton time — the reader header. */
function formatSentFull(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: EVENT_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ListBadges({ lists, max = 2 }: { lists: string[]; max?: number }) {
  if (lists.length === 0) return null;
  const shown = lists.slice(0, max);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {shown.map((l) => (
        <span
          key={l}
          className="rounded-full bg-forum-turquoise-50 px-2 py-px font-dm-mono text-[10px] uppercase text-forum-dark-gray"
        >
          {l}
        </span>
      ))}
      {lists.length > max && (
        <span
          className="font-dm-sans text-[10px] text-forum-light-gray"
          title={lists.slice(max).join(", ")}
        >
          +{lists.length - max}
        </span>
      )}
    </span>
  );
}

/**
 * "Recent emails" on an org page: compact rows (subject, sender, date, lists,
 * preview) from InboxEngine; a row opens a side reader that loads the full
 * email and renders it with RichText.
 */
export function OrgEmails({
  total,
  messages,
  browseUrl,
  prominent = false,
}: {
  total: number;
  messages: InboxMessage[];
  /** TigerInbox page filtered to this org. */
  browseUrl: string;
  /** Rendered first (and larger) when the org has no upcoming events. */
  prominent?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxMessageDetail | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const selected = messages.find((m) => m.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    setDetail(null);
    setState("loading");
    getInboxEmail(openId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setState(d ? "idle" : "error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  if (messages.length === 0) return null;
  const shown = detail ?? selected;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="org-emails-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="org-emails-heading"
          className={cn(
            "flex items-center gap-2 font-dm-sans font-semibold text-black",
            prominent ? "text-base" : "text-sm",
          )}
        >
          Recent emails
          <span className="font-normal text-forum-light-gray">{total}</span>
        </h2>
        <a
          href={browseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-dm-sans text-[12px] font-medium text-forum-cerulean hover:underline"
        >
          Browse all {total} {total === 1 ? "email" : "emails"} in TigerInbox
          <ExternalLink size={12} aria-hidden />
        </a>
      </div>

      <ul className="divide-y divide-forum-border overflow-hidden rounded-[20px] border border-forum-border bg-white">
        {messages.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setOpenId(m.id)}
              className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-forum-turquoise/10 focus-visible:bg-forum-turquoise/10 focus-visible:outline-none sm:px-5"
            >
              <span className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate font-dm-sans text-[14px] font-semibold text-black">
                  {m.subject}
                </span>
                <time
                  dateTime={m.sentAt}
                  className="shrink-0 font-dm-sans text-[12px] text-forum-light-gray"
                >
                  {formatSentAt(m.sentAt)}
                </time>
              </span>
              <span className="flex items-center gap-2">
                <span className="min-w-0 truncate font-dm-sans text-[12px] text-forum-dark-gray">
                  {m.sender ?? m.senderEmail ?? "Unknown sender"}
                </span>
                <ListBadges lists={m.listservs} />
              </span>
              {m.preview && (
                <span className="line-clamp-2 font-dm-sans text-[12px] leading-snug text-forum-light-gray">
                  {m.preview}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {shown && (
            <>
              <SheetHeader className="border-b border-forum-border pr-12">
                <SheetTitle className="font-serif text-[20px] leading-snug">
                  {shown.subject}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-col gap-1.5 font-dm-sans text-[12px] text-forum-dark-gray">
                    <span>
                      <span className="font-semibold text-black">
                        {shown.sender ?? shown.senderEmail ?? "Unknown sender"}
                      </span>
                      {shown.sender && shown.senderEmail && (
                        <span className="text-forum-light-gray"> &lt;{shown.senderEmail}&gt;</span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <time dateTime={shown.sentAt}>{formatSentFull(shown.sentAt)} ET</time>
                      <ListBadges lists={shown.listservs} max={6} />
                    </span>
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 p-4 sm:p-5">
                {state === "loading" ? (
                  // The first open can take ~10s: InboxEngine may fetch the
                  // original from LISTSERV on demand.
                  <div className="flex flex-col gap-3">
                    <LoadingState label="Fetching the full email…" className="py-6" />
                    {shown.preview && (
                      <div className="opacity-60">
                        <RichText text={shown.preview} />
                      </div>
                    )}
                  </div>
                ) : state === "error" ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-dm-sans text-[13px] text-forum-light-gray">
                      Couldn't load the full email right now. Here's the preview:
                    </p>
                    <RichText text={shown.preview} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {detail && !detail.complete && (
                      <p className="rounded-xl bg-forum-yellow-50 px-3 py-2 font-dm-sans text-[12px] text-forum-dark-gray">
                        Only a preview is archived.{" "}
                        {detail.url ? (
                          <a
                            href={detail.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-forum-cerulean hover:underline"
                          >
                            Open in TigerInbox
                          </a>
                        ) : (
                          "Open in TigerInbox"
                        )}{" "}
                        for the original.
                      </p>
                    )}
                    <RichText text={detail?.body ?? shown.preview} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-forum-border p-4 font-dm-sans text-[13px] sm:px-5">
                {shown.url && (
                  <a
                    href={shown.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-forum-cerulean hover:underline"
                  >
                    <Mail size={14} aria-hidden />
                    Open in TigerInbox
                  </a>
                )}
                {shown.archiveUrl && (
                  <a
                    href={shown.archiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-forum-light-gray hover:text-black hover:underline"
                  >
                    Listserv archive
                    <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
