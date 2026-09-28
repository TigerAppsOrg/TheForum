"use client";

import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  MapPin,
  Maximize2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { logInteraction } from "~/actions/interactions";
import { OrgAvatar } from "~/components/common/org-avatar";
import { AttendeesDialog } from "~/components/events/attendees-dialog";
import { AvatarStack } from "~/components/social/avatar-stack";
import { Button } from "~/components/ui/button";
import { buildGCalUrl } from "~/lib/calendar";
import { formatDateBadge, formatTime } from "~/lib/date-format";
import { descriptionPreview, eventPhotoUrl } from "~/lib/event-media";
import { cn } from "~/lib/utils";

export const CATEGORY_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  "visual arts": { bg: "rgba(255,156,133,0.1)", accent: "#fb923c", text: "#9a3412" },
  tech: { bg: "rgba(162,239,240,0.15)", accent: "#a78bfa", text: "#5b21b6" },
  music: { bg: "rgba(254,232,130,0.15)", accent: "#fbbf24", text: "#854d0e" },
  athletics: { bg: "rgba(162,239,240,0.15)", accent: "#60a5fa", text: "#1e3a8a" },
  "social event": { bg: "rgba(255,211,234,0.2)", accent: "#f472b6", text: "#9d174d" },
  career: { bg: "rgba(162,239,240,0.15)", accent: "#34d399", text: "#065f46" },
  "free food": { bg: "rgba(255,156,133,0.1)", accent: "#FF7151", text: "#991b1b" },
  academics: { bg: "rgba(162,239,240,0.15)", accent: "#0A9CD5", text: "#0c4a6e" },
  culture: { bg: "rgba(254,232,130,0.15)", accent: "#f59e0b", text: "#78350f" },
  "performing arts": { bg: "rgba(162,239,240,0.15)", accent: "#14b8a6", text: "#134e4a" },
};

const DEFAULT_COLOR = { bg: "rgba(255,156,133,0.1)", accent: "#D9D9D9", text: "#585858" };

/**
 * Hover wash for the card's utility icons (save, share, hide, open).
 *
 * Those glyphs are coral, and the Button `ghost` variant hovers to `--accent`
 * — full-strength turquoise (#a2eff0) — which clashed behind them. A 25% coral
 * tint keeps the hover in the same family as the icon it sits under.
 */
const UTILITY_HOVER = "hover:bg-forum-coral-light";

export function getCategoryColor(tags: string[]) {
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  }
  return DEFAULT_COLOR;
}

export interface EventCardProps {
  id: string;
  title: string;
  orgId?: string | null;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  datetime: string;
  /** ISO start time — powers the date block on `row` density. */
  rawDatetime?: string | null;
  location: string;
  /** Room or free-text place within the venue, e.g. "Room 207". */
  locationDetail?: string | null;
  description?: string | null;
  tags: string[];
  /** Event photo (MyPrincetonU events often have one) — a thumbnail when present. */
  flyerUrl?: string | null;
  rsvpCount?: number;
  friendsAttending?: { id: string; displayName: string; avatarUrl?: string | null }[];
  /** Everyone attending — shown as an avatar stack + "N attending". */
  attendees?: { id: string; displayName: string; avatarUrl?: string | null }[];
  isSaved?: boolean;
  isRsvped?: boolean;
  /*
   * Actions render only when a handler is supplied.
   *
   * These may be async. The card awaits the returned promise and only
   * announces success once it resolves, so a rejected save/RSVP shows the
   * owner's error toast alone instead of a success toast beside it.
   */
  onSaveToggle?: () => void | Promise<void>;
  onRsvpToggle?: () => void | Promise<void>;
  onShare?: () => void;
  onHide?: () => void;
  /** When true the card collapses to a stub that can be restored. */
  isHidden?: boolean;
  onUnhide?: () => void;
  /** Extra action, e.g. the map's "Show on map". */
  onLocate?: () => void;
  /**
   * Open the event in place instead of navigating to its page. The map uses
   * this so opening a card doesn't throw you off the map.
   */
  onOpen?: () => void;
  /**
   * `default` is the full feed card. `compact` drops the description and the
   * friends sentence for narrow columns — the map's 320px rail and an org
   * profile's event list. `wide` is a full-width card. `row` is the dense
   * list item (date block, title, time · place · host, save) used by Explore
   * and My Events — render rows inside a bordered, divided list.
   */
  density?: "default" | "compact" | "wide" | "row";
  /** Google Calendar link; renders the Calendar action when supplied. */
  calendarUrl?: string;
  /**
   * Owner controls. Supplied only for events the viewer created, so the
   * card itself does no permission checking.
   */
  editHref?: string;
  onDelete?: () => void;
  /** Where this card is displayed — logged with interactions */
  source?: "feed" | "search" | "map" | "similar" | "notification";
  /** Position in the list — for position bias correction */
  position?: number;
  className?: string;
}

/**
 * The event card, used on Explore, My Events, the map rail and org profiles.
 *
 * Each of those surfaces previously had its own card component, so the same
 * event rendered with a different title size, tag colour and metadata order
 * depending on where you saw it. Density is the only thing that varies now.
 */
export function EventCard({
  id,
  title,
  orgId,
  orgName,
  orgLogoUrl,
  datetime,
  rawDatetime,
  location,
  locationDetail,
  description,
  tags,
  flyerUrl,
  rsvpCount,
  friendsAttending = [],
  attendees = [],
  isSaved,
  isRsvped,
  onSaveToggle,
  onRsvpToggle,
  onShare,
  onHide,
  isHidden = false,
  onUnhide,
  onLocate,
  onOpen,
  density = "default",
  calendarUrl,
  editHref,
  onDelete,
  source = "feed",
  position,
  className,
}: EventCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const compact = density === "compact";
  const wide = density === "wide";

  /*
   * Ingested events often have no location, and the server substitutes the
   * string "TBD" for a missing one — rendering that verbatim next to a map pin
   * reads as a bug. Treat it as absent and drop the row instead.
   */
  const hasLocation = Boolean(location) && location !== "TBD";
  const locationLine = hasLocation && locationDetail ? `${location} · ${locationDetail}` : location;
  const photoUrl = eventPhotoUrl(flyerUrl);
  // Full cards always offer "+ Calendar" (Figma); built here when the caller didn't.
  const cardCalendarUrl =
    calendarUrl ??
    (density === "default" && rawDatetime
      ? buildGCalUrl({
          title,
          description: description ?? null,
          datetime: new Date(rawDatetime),
          endDatetime: null,
          locationName: hasLocation ? location : null,
        })
      : undefined);
  const preview = descriptionPreview(description);

  const displayedFriendNames = friendsAttending.slice(0, 2).map((friend) => friend.displayName);
  const remainingFriends = friendsAttending.length - displayedFriendNames.length;
  // Friends shown here have RSVP'd — nothing is read from anyone's calendar.
  const othersLabel = `+ ${remainingFriends} ${remainingFriends === 1 ? "other" : "others"}`;
  const goingVerb = friendsAttending.length === 1 ? "is going!" : "are going!";

  // Track view — IntersectionObserver fires after 1s of visibility
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          logInteraction({ itemId: id, interactionType: "view", metadata: { source, position } });
          observer.disconnect(); // only log once per mount
        }
      },
      { threshold: 0.5 },
    );
    // Delay observation by 1s to avoid scroll-by noise
    const timer = setTimeout(() => observer.observe(el), 1000);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [id, source, position]);

  const trackClick = () => {
    logInteraction({ itemId: id, interactionType: "click", metadata: { source, position } });
  };

  const hasUtilityRow = Boolean(onSaveToggle || onShare || onHide);

  /*
   * Hidden events collapse to a stub rather than disappearing. Removing the
   * card outright left no way back short of a page reload, so a mis-click was
   * unrecoverable.
   */
  if (isHidden) {
    return (
      <div
        ref={cardRef}
        className={cn(
          "flex w-full items-center justify-between gap-3",
          density === "row" ? "px-3 py-1.5 sm:px-4" : "card rounded-xl px-5 py-3",
          className,
        )}
      >
        <p className="min-w-0 font-dm-sans text-[13px] text-forum-light-gray">
          Hidden — <span className="truncate font-medium text-forum-dark-gray">{title}</span>
        </p>
        {onUnhide && (
          <Button variant="quiet" size="sm" className="shrink-0" onClick={onUnhide}>
            <Eye />
            Unhide
          </Button>
        )}
      </div>
    );
  }

  /*
   * Row layout: the dense list item. The title link stretches over the whole
   * row (one tab stop, big click target); the host link and action buttons sit
   * above it with `relative z-10`.
   */
  if (density === "row") {
    const start = rawDatetime ? new Date(rawDatetime) : null;
    const badge = start ? formatDateBadge(start) : null;
    const when = start ? formatTime(start) : datetime;
    const utilityButton =
      "relative z-10 text-forum-light-gray hover:bg-forum-coral-light hover:text-forum-coral";

    return (
      <article
        ref={cardRef}
        className={cn(
          "group relative flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-forum-turquoise/10 sm:px-4",
          className,
        )}
      >
        {badge && (
          <div aria-hidden className="w-10 shrink-0 pt-0.5 text-center leading-none">
            <div className="font-dm-sans text-[10px] font-bold tracking-wide text-forum-coral">
              {badge.month}
            </div>
            <div className="mt-0.5 font-serif text-[20px] font-semibold text-black">
              {badge.day}
            </div>
            <div className="mt-0.5 font-dm-sans text-[10px] text-forum-light-gray">
              {badge.weekday}
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          {onOpen ? (
            <button
              type="button"
              onClick={() => {
                trackClick();
                onOpen();
              }}
              className="text-left font-dm-sans text-[14px] font-semibold leading-snug text-black line-clamp-2 sm:line-clamp-1 after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
            >
              {title}
            </button>
          ) : (
            <Link
              href={`/events/${id}`}
              onClick={trackClick}
              className="font-dm-sans text-[14px] font-semibold leading-snug text-black line-clamp-2 sm:line-clamp-1 after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
            >
              {title}
            </Link>
          )}
          <p className="mt-0.5 truncate font-dm-sans text-[12px] text-forum-dark-gray">
            {badge ? when : datetime}
            {hasLocation && <> · {location}</>}
            {orgName && (
              <>
                {" · "}
                {orgId ? (
                  <Link
                    href={`/orgs/${orgId}`}
                    className="relative z-10 font-medium hover:text-forum-cerulean hover:underline"
                  >
                    {orgName}
                  </Link>
                ) : (
                  <span className="font-medium">{orgName}</span>
                )}
              </>
            )}
          </p>
          {(friendsAttending.length > 0 || tags.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-dm-sans text-[11px]">
              {friendsAttending.length > 0 && (
                <span className="font-medium text-forum-coral">
                  {displayedFriendNames.join(", ")}
                  {remainingFriends > 0 && ` ${othersLabel}`} {goingVerb}
                </span>
              )}
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-forum-medium-gray/70 px-1.5 py-px text-forum-dark-gray"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {onHide && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                utilityButton,
                "hidden md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
              )}
              aria-label={`Hide ${title}`}
              onClick={() => {
                logInteraction({
                  itemId: id,
                  interactionType: "hide",
                  metadata: { source, position },
                });
                onHide();
              }}
            >
              <EyeOff />
            </Button>
          )}
          {onShare && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                utilityButton,
                "hidden md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
              )}
              aria-label={`Copy link to ${title}`}
              onClick={() => {
                logInteraction({
                  itemId: id,
                  interactionType: "share",
                  metadata: { source, position },
                });
                onShare();
              }}
            >
              <Share2 />
            </Button>
          )}
          {editHref && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className={utilityButton}
              aria-label={`Edit ${title}`}
            >
              <Link href={editHref}>
                <Edit3 />
              </Link>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={utilityButton}
              aria-label={`Delete ${title}`}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          )}
          {onSaveToggle && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(utilityButton, isSaved && "text-forum-coral")}
              aria-label={isSaved ? `Unsave ${title}` : `Save ${title}`}
              aria-pressed={isSaved}
              onClick={async () => {
                logInteraction({
                  itemId: id,
                  interactionType: "save",
                  metadata: { source, position },
                });
                const wasSaved = isSaved;
                try {
                  await onSaveToggle();
                } catch {
                  return;
                }
                toast(wasSaved ? `Removed ${title} from saved` : `Saved ${title}`);
              }}
            >
              {isSaved ? <BookmarkCheck /> : <Bookmark />}
            </Button>
          )}
          {onRsvpToggle && (
            <Button
              variant={isRsvped ? "cerulean" : "outline"}
              size="xs"
              aria-pressed={isRsvped}
              className="relative z-10 ml-1 h-7 rounded-full px-3 text-[12px]"
              onClick={async () => {
                logInteraction({
                  itemId: id,
                  interactionType: "rsvp",
                  metadata: { source, position },
                });
                const wasRsvped = isRsvped;
                try {
                  await onRsvpToggle();
                } catch {
                  return;
                }
                if (wasRsvped) toast(`Removed your RSVP to ${title}`);
                else toast.success(`You're going to ${title}`);
              }}
            >
              {isRsvped ? (
                <>
                  <Check />
                  Going
                </>
              ) : (
                "RSVP"
              )}
            </Button>
          )}
        </div>
      </article>
    );
  }

  /*
   * Wide layout: a full-width row for My Events, where each list is a single
   * column and there's horizontal room to put the details and the blurb side
   * by side, with the actions gathered in the header.
   */
  if (wide) {
    return (
      <div ref={cardRef} className={cn("card relative w-full rounded-xl px-5 py-4", className)}>
        {/* Header: org · calendar/RSVP · utilities */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {orgName && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="size-7 shrink-0 overflow-hidden rounded border-2 border-forum-medium-gray bg-forum-turquoise/30">
                {orgLogoUrl && <img src={orgLogoUrl} alt="" className="size-full object-cover" />}
              </div>
              <span className="truncate font-dm-sans text-[14px] font-bold text-black">
                {orgName}
              </span>
            </div>
          )}

          {/* Full-width action row on phones; pushed right once there's room */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            {calendarUrl && (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
                  <Plus />
                  Calendar
                </a>
              </Button>
            )}
            {onRsvpToggle && (
              <Button
                variant={isRsvped ? "cerulean" : "coral"}
                size="sm"
                aria-pressed={isRsvped}
                className="rounded-full px-6"
                onClick={async () => {
                  logInteraction({
                    itemId: id,
                    interactionType: "rsvp",
                    metadata: { source, position },
                  });
                  const wasRsvped = isRsvped;
                  try {
                    await onRsvpToggle();
                  } catch {
                    return; // the owner already surfaced the failure
                  }
                  if (wasRsvped) toast(`Removed your RSVP to ${title}`);
                  else toast.success(`You're going to ${title}`);
                }}
              >
                {isRsvped ? (
                  <>
                    <Check />
                    RSVP'd
                  </>
                ) : (
                  "RSVP"
                )}
              </Button>
            )}

            <div className="flex items-center gap-0.5">
              {onSaveToggle && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={UTILITY_HOVER}
                  aria-label={isSaved ? `Unsave ${title}` : `Save ${title}`}
                  aria-pressed={isSaved}
                  onClick={async () => {
                    const wasSaved = isSaved;
                    try {
                      await onSaveToggle();
                    } catch {
                      return;
                    }
                    toast(wasSaved ? `Removed ${title} from saved` : `Saved ${title}`);
                  }}
                >
                  {isSaved ? (
                    <BookmarkCheck className="text-forum-coral" />
                  ) : (
                    <Bookmark className="text-forum-coral" />
                  )}
                </Button>
              )}
              {onShare && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={UTILITY_HOVER}
                  aria-label={`Share ${title}`}
                  onClick={onShare}
                >
                  <Share2 className="text-forum-coral" />
                </Button>
              )}
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className={UTILITY_HOVER}
                aria-label={`Open ${title}`}
              >
                <Link href={`/events/${id}`} onClick={trackClick}>
                  <Maximize2 className="text-forum-coral" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Body: details left, social + blurb right */}
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="min-w-0">
            <Link href={`/events/${id}`} onClick={trackClick}>
              <h3 className="font-serif text-[22px] leading-tight text-black line-clamp-2 hover:underline">
                {title}
              </h3>
            </Link>
            <div className="mt-1.5 flex flex-col gap-1">
              {hasLocation && (
                <span className="flex items-center gap-1.5 font-dm-sans text-[13px] text-forum-dark-gray">
                  <MapPin size={12} aria-hidden className="shrink-0 text-forum-light-gray" />
                  {location}
                </span>
              )}
              <span className="flex items-center gap-1.5 font-dm-sans text-[13px] text-forum-dark-gray">
                <Clock size={12} aria-hidden className="shrink-0 text-forum-light-gray" />
                {datetime}
              </span>
            </div>
            {tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-dm-sans text-[13px] text-black",
                      i === 0 ? "bg-forum-yellow-50" : "bg-forum-turquoise-50",
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {friendsAttending.length > 0 && (
              <div className="mb-1.5 flex items-start gap-2">
                <AvatarStack users={friendsAttending} size={28} max={3} />
                <p className="font-dm-sans text-[13px] leading-tight text-forum-dark-gray">
                  <span className="font-bold text-forum-coral">
                    {displayedFriendNames.join(", ")}
                  </span>
                  {remainingFriends > 0 && (
                    <span className="font-bold text-forum-coral"> {othersLabel}</span>
                  )}{" "}
                  {goingVerb}
                </p>
              </div>
            )}
            {description && (
              <p className="font-dm-sans text-[13px] leading-relaxed text-forum-dark-gray line-clamp-3">
                {description}
              </p>
            )}
            <Link
              href={`/events/${id}`}
              onClick={trackClick}
              className="mt-1 inline-block font-dm-sans text-[13px] font-medium text-forum-coral hover:underline"
            >
              See Details
            </Link>
          </div>
        </div>

        {/*
          Owner controls, pinned to the card's bottom-right. Only rendered for
          events you created — the card does no permission checking of its own.
        */}
        {(editHref || onDelete) && (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {editHref && (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={editHref}>
                  <Edit3 />
                  Edit
                </Link>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-forum-coral/40 text-forum-coral hover:bg-forum-coral/5"
                onClick={onDelete}
              >
                <Trash2 />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      /* Width is owned by the parent list/grid — the card fills its slot so it
         renders identically on Explore, My Events, Map and org pages. */
      className={cn(
        "card group relative flex w-full flex-col overflow-hidden",
        compact ? "gap-2 rounded-xl p-3" : "gap-0.5 rounded-[24px] px-5 pt-4 pb-5",
        className,
      )}
    >
      {/*
        Save, Share, Hide & Expand.

        The icon buttons are 32px boxes around a 16px glyph, so they carry 8px
        of internal padding. The negative margins cancel that, putting the
        glyphs on the same left/right edges as the text below.
      */}
      {hasUtilityRow && (
        <div className="-mx-2 flex flex-row justify-between">
          <div className="flex items-center gap-0.5">
            {onSaveToggle && (
              <Button
                variant="ghost"
                size="icon-sm"
                className={UTILITY_HOVER}
                aria-label={isSaved ? `Unsave ${title}` : `Save ${title}`}
                aria-pressed={isSaved}
                onClick={async (e) => {
                  e.preventDefault();
                  logInteraction({
                    itemId: id,
                    interactionType: "save",
                    metadata: { source, position },
                  });
                  const wasSaved = isSaved;
                  try {
                    await onSaveToggle();
                  } catch {
                    return;
                  }
                  toast(wasSaved ? `Removed ${title} from saved` : `Saved ${title}`);
                }}
              >
                {isSaved ? (
                  <BookmarkCheck className="text-forum-coral" />
                ) : (
                  <Bookmark className="text-forum-coral" />
                )}
              </Button>
            )}
            {onShare && (
              <Button
                variant="ghost"
                size="icon-sm"
                className={UTILITY_HOVER}
                aria-label={`Share ${title}`}
                onClick={(e) => {
                  e.preventDefault();
                  logInteraction({
                    itemId: id,
                    interactionType: "share",
                    metadata: { source, position },
                  });
                  onShare();
                }}
              >
                <Share2 className="text-forum-coral" />
              </Button>
            )}
            {/* Hide: revealed on hover/focus on desktop so the resting card shows the
               Figma's two icons; always visible on touch. */}
            {onHide && (
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  UTILITY_HOVER,
                  "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                )}
                aria-label={`Hide ${title}`}
                onClick={(e) => {
                  e.preventDefault();
                  logInteraction({
                    itemId: id,
                    interactionType: "hide",
                    metadata: { source, position },
                  });
                  onHide();
                  toast(`Hid ${title}`, { description: "Use Unhide to bring it back." });
                }}
              >
                <EyeOff className="text-forum-coral" />
              </Button>
            )}
          </div>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className={UTILITY_HOVER}
            aria-label={`Open ${title}`}
          >
            <Link href={`/events/${id}`} onClick={trackClick}>
              <Maximize2 className="text-forum-coral" />
            </Link>
          </Button>
        </div>
      )}

      {/*
        Org + title, with the event photo as a thumbnail beside them when one
        exists. A thumbnail rather than a banner keeps cards with and without
        photos the same height in the grid.
      */}
      <div className={cn("flex items-start gap-3", !compact && "mt-3")}>
        <div className="min-w-0 flex-1">
          {orgName && (
            <div className="flex items-center gap-2.5">
              <OrgAvatar name={orgName} logoUrl={orgLogoUrl} size={compact ? 26 : 40} />
              <p className="min-w-0 truncate font-dm-sans text-[13px] text-forum-dark-gray">
                {orgId ? (
                  <Link
                    href={`/orgs/${orgId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold transition-colors hover:text-forum-cerulean"
                  >
                    {orgName}
                  </Link>
                ) : (
                  <span className="font-semibold">{orgName}</span>
                )}
              </p>
            </div>
          )}

          {/* Title — opens in place when `onOpen` is given, otherwise navigates */}
          {onOpen ? (
            <button
              type="button"
              onClick={() => {
                trackClick();
                onOpen();
              }}
              className="mt-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
            >
              <h3
                className={cn(
                  "font-serif leading-[1.2] text-black line-clamp-2 hover:underline",
                  compact ? "text-[17px] font-bold" : "text-[18px]",
                )}
              >
                {title}
              </h3>
            </button>
          ) : (
            <Link href={`/events/${id}`} onClick={trackClick} className="mt-2 block">
              <h3
                className={cn(
                  "font-serif leading-[1.2] text-black line-clamp-2 hover:underline",
                  compact ? "text-[17px] font-bold" : "text-[20px] font-semibold",
                )}
              >
                {title}
              </h3>
            </Link>
          )}
        </div>
        {!compact && photoUrl && (
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            className="size-[76px] shrink-0 rounded-2xl border border-forum-medium-gray object-cover"
          />
        )}
      </div>

      {/* Location & Time */}
      <div className="mt-1.5 flex flex-col gap-1">
        {hasLocation && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} aria-hidden className="shrink-0 text-forum-light-gray" />
            <span className="truncate font-dm-sans text-[12px] text-forum-dark-gray">
              {locationLine}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Clock size={12} aria-hidden className="shrink-0 text-forum-light-gray" />
          <span className="font-dm-sans text-[12px] text-forum-dark-gray">{datetime}</span>
        </div>
      </div>

      {/*
        Tags. Compact cards stack them vertically and leave a right-hand gutter
        so the corner avatars never sit on top of a label.
      */}
      {tags.length > 0 && (
        <div
          className={cn(
            "mt-2.5 flex gap-1.5",
            compact
              ? cn("flex-col items-start", friendsAttending.length > 0 && "pr-20")
              : "flex-wrap",
          )}
        >
          {tags.slice(0, compact ? 2 : 3).map((tag) => (
            <span
              key={tag}
              className={cn(
                "rounded-full px-2.5 py-0.5 font-dm-sans text-[12px] text-black",
                // Figma: free food is pale yellow; every other tag pale turquoise.
                tag === "free food" ? "bg-forum-yellow-50" : "bg-forum-turquoise-50",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Friends attending — a corner cluster on compact cards, an inline row elsewhere */}
      {friendsAttending.length > 0 &&
        (compact ? (
          <div className="pointer-events-none absolute right-3 bottom-3">
            <AvatarStack users={friendsAttending} size={34} max={3} />
          </div>
        ) : (
          <div className="mt-2.5 flex flex-row items-center gap-2">
            <AvatarStack users={friendsAttending} size={30} max={3} />
            <p className="font-dm-sans text-[12px] leading-tight text-forum-dark-gray">
              <span className="font-bold text-forum-coral">
                {displayedFriendNames.join(", ")}
                {remainingFriends > 0 && ` ${othersLabel}`}
              </span>{" "}
              {goingVerb}
            </p>
          </div>
        ))}

      {/* Description — full card only. Clamped to the mock's three lines, with
          "See Details" carrying the rest. */}
      {!compact && preview && (
        <>
          <p className="mt-2.5 font-dm-sans text-[12px] leading-relaxed text-forum-dark-gray line-clamp-3">
            {preview}
          </p>
          <Link
            href={`/events/${id}`}
            onClick={trackClick}
            className="mt-1 self-start font-dm-sans text-[12px] font-medium text-forum-coral hover:underline"
          >
            See Details
          </Link>
        </>
      )}

      {/* Owner controls — only passed for events the viewer created. */}
      {!compact && (editHref || onDelete) && (
        <div className="mt-2.5 flex items-center gap-3 font-dm-sans text-[12px]">
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex items-center gap-1 font-medium text-forum-cerulean hover:underline"
            >
              <Edit3 size={12} aria-hidden /> Edit
            </Link>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 font-medium text-forum-coral hover:underline"
            >
              <Trash2 size={12} aria-hidden /> Delete
            </button>
          )}
        </div>
      )}

      {/* Footer actions — right gutter keeps clear of the corner avatar cluster */}
      {(onRsvpToggle || onLocate || cardCalendarUrl) && (
        <div
          /* `mt-auto` pins the actions to the card's bottom edge, so RSVP
             buttons line up across a grid row even when one card's blurb is
             shorter than its neighbour's. No effect where cards size to their
             content, as in the map rail. */
          className={cn(
            "mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3",
            compact && friendsAttending.length > 0 && "pr-20",
          )}
        >
          {onLocate ? (
            <button
              type="button"
              onClick={onLocate}
              className="flex items-center gap-1 font-dm-sans text-[11px] font-medium text-forum-cerulean hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
            >
              <MapPin size={10} aria-hidden />
              Show on map
            </button>
          ) : (
            /* Avatar stack + "N attending", clickable to see the full list. */
            (attendees.length > 0 || Boolean(rsvpCount)) && (
              <div className="flex min-w-0 items-center gap-2">
                {attendees.length > 0 && <AvatarStack users={attendees} size={24} max={3} />}
                {rsvpCount ? (
                  <AttendeesDialog
                    attendees={attendees}
                    count={rsvpCount}
                    friendIds={new Set(friendsAttending.map((f) => f.id))}
                    /* Sized to the card's own metadata scale — 14px bold black
                       shouted over the title's own details — and kept on one
                       line, which is what wrapped to "4 / attending". */
                    className="whitespace-nowrap text-[12px] font-medium text-forum-dark-gray"
                  />
                ) : null}
              </div>
            )
          )}

          {/* Calendar + RSVP, gathered at the card's bottom-right as in the mock. */}
          <div className="ml-auto flex items-center gap-2">
            {cardCalendarUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-[11px] font-bold uppercase tracking-wide"
              >
                <a href={cardCalendarUrl} target="_blank" rel="noopener noreferrer">
                  <Plus />
                  Calendar
                </a>
              </Button>
            )}
            {onRsvpToggle && (
              <Button
                variant={isRsvped ? "cerulean" : "coral"}
                size="sm"
                className="text-[11px] font-bold uppercase tracking-wide"
                aria-pressed={isRsvped}
                onClick={async (e) => {
                  e.preventDefault();
                  logInteraction({
                    itemId: id,
                    interactionType: "rsvp",
                    metadata: { source, position },
                  });
                  const wasRsvped = isRsvped;
                  try {
                    await onRsvpToggle();
                  } catch {
                    return;
                  }
                  // Confirm the action explicitly — the label flip alone was easy
                  // to miss, especially far down the feed.
                  if (wasRsvped) {
                    toast(`Removed your RSVP to ${title}`);
                  } else {
                    toast.success(`You're going to ${title}`);
                  }
                }}
              >
                {isRsvped ? (
                  <>
                    <Check />
                    RSVP'd
                  </>
                ) : (
                  "RSVP"
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
