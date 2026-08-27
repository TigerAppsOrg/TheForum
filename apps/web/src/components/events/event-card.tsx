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
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { logInteraction } from "~/actions/interactions";
import { AttendeesDialog } from "~/components/events/attendees-dialog";
import { AvatarStack } from "~/components/social/avatar-stack";
import { Button } from "~/components/ui/button";
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
  location: string;
  description?: string | null;
  tags: string[];
  flyerUrl?: string | null;
  rsvpCount?: number;
  friendsAttending?: { id: string; displayName: string; avatarUrl?: string | null }[];
  /** Everyone attending — shown as an avatar stack + "N attending". */
  attendees?: { id: string; displayName: string; avatarUrl?: string | null }[];
  isSaved?: boolean;
  isRsvped?: boolean;
  /** Actions render only when a handler is supplied. */
  onSaveToggle?: () => void;
  onRsvpToggle?: () => void;
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
   * profile's event list. `wide` is the full-width row used by My Events.
   */
  density?: "default" | "compact" | "wide";
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
  location,
  description,
  tags,
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

  const displayedFriendNames = friendsAttending.slice(0, 2).map((friend) => friend.displayName);
  const remainingFriends = friendsAttending.length - displayedFriendNames.length;

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
          "card flex w-full items-center justify-between gap-3 rounded-xl px-5 py-3",
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
                onClick={() => {
                  logInteraction({
                    itemId: id,
                    interactionType: "rsvp",
                    metadata: { source, position },
                  });
                  onRsvpToggle();
                  if (isRsvped) toast(`Removed your RSVP to ${title}`);
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
                  aria-label={isSaved ? `Unsave ${title}` : `Save ${title}`}
                  aria-pressed={isSaved}
                  onClick={() => {
                    onSaveToggle();
                    toast(isSaved ? `Removed ${title} from saved` : `Saved ${title}`);
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
                  aria-label={`Share ${title}`}
                  onClick={onShare}
                >
                  <Share2 className="text-forum-coral" />
                </Button>
              )}
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${title}`}>
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
              {location && (
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
                    <span className="font-bold text-forum-coral"> + {remainingFriends} other</span>
                  )}{" "}
                  added this event to their calendar!
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
        "card group relative flex w-full flex-col overflow-hidden rounded-xl",
        compact ? "gap-2 p-3" : "gap-0.5 px-5 py-5",
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
                aria-label={isSaved ? `Unsave ${title}` : `Save ${title}`}
                aria-pressed={isSaved}
                onClick={(e) => {
                  e.preventDefault();
                  logInteraction({
                    itemId: id,
                    interactionType: "save",
                    metadata: { source, position },
                  });
                  onSaveToggle();
                  toast(isSaved ? `Removed ${title} from saved` : `Saved ${title}`);
                }}
              >
                {isSaved ? (
                  <BookmarkCheck className="text-forum-cerulean" />
                ) : (
                  <Bookmark className="text-forum-dark-gray" />
                )}
              </Button>
            )}
            {onShare && (
              <Button
                variant="ghost"
                size="icon-sm"
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
                <Share2 className="text-forum-dark-gray" />
              </Button>
            )}
            {/* Hide was previously an unreachable prop — no control ever called it. */}
            {onHide && (
              <Button
                variant="ghost"
                size="icon-sm"
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
                <EyeOff className="text-forum-dark-gray" />
              </Button>
            )}
          </div>
          <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${title}`}>
            <Link href={`/events/${id}`} onClick={trackClick}>
              <Maximize2 className="text-forum-dark-gray" />
            </Link>
          </Button>
        </div>
      )}

      {/* Org */}
      {orgName && (
        <div className={cn("flex items-center gap-2", !compact && "mt-4")}>
          <div className="size-6 shrink-0 overflow-hidden rounded border-2 border-forum-medium-gray bg-forum-turquoise/30">
            {orgLogoUrl && <img src={orgLogoUrl} alt="" className="size-full object-cover" />}
          </div>
          <p className="min-w-0 truncate font-dm-sans text-[12px] text-forum-dark-gray">
            {orgId ? (
              <Link
                href={`/orgs/${orgId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-bold transition-colors hover:text-forum-cerulean"
              >
                {orgName}
              </Link>
            ) : (
              <span className="font-bold">{orgName}</span>
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
        <Link href={`/events/${id}`} onClick={trackClick} className="mt-1">
          <h3
            className={cn(
              "font-serif leading-[1.2] text-black line-clamp-2 hover:underline",
              compact ? "text-[17px] font-bold" : "text-[18px]",
            )}
          >
            {title}
          </h3>
        </Link>
      )}

      {/* Location & Time */}
      <div className="mt-1 flex flex-col gap-1">
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} aria-hidden className="shrink-0 text-forum-light-gray" />
            <span className="truncate font-dm-sans text-[12px] text-forum-dark-gray">
              {location}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Clock size={11} aria-hidden className="shrink-0 text-forum-light-gray" />
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
          {tags.slice(0, compact ? 2 : 3).map((tag, i) => (
            <span
              key={tag}
              className={cn(
                "rounded-[10px] px-2 py-px font-dm-sans text-[12px] text-black",
                compact && i === 1 ? "bg-forum-turquoise-50" : "bg-forum-yellow-50",
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
            <AvatarStack users={friendsAttending} size={30} max={5} />
            <p className="font-dm-sans text-[12px] leading-tight text-forum-dark-gray">
              <span className="font-bold text-forum-coral">
                {displayedFriendNames.join(
                  displayedFriendNames.length === 2 && remainingFriends === 0 ? " and " : ", ",
                )}
              </span>
              {remainingFriends > 0 && <span> + {remainingFriends} more</span>}
              <span> {friendsAttending.length === 1 ? "is" : "are"} also going.</span>
            </p>
          </div>
        ))}

      {/* Description — full card only */}
      {!compact && description && (
        <p className="mt-2.5 font-dm-sans text-[12px] leading-relaxed text-black line-clamp-3">
          {description}
        </p>
      )}

      {/* Footer actions — right gutter keeps clear of the corner avatar cluster */}
      {(onRsvpToggle || onLocate) && (
        <div
          className={cn(
            "mt-3 flex items-center justify-between gap-2",
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
            <div className="flex min-w-0 items-center gap-2.5">
              {attendees.length > 0 && <AvatarStack users={attendees} size={28} max={4} />}
              {rsvpCount ? (
                <div className="flex items-center gap-1.5">
                  <Users size={14} aria-hidden className="shrink-0 text-forum-light-gray" />
                  <AttendeesDialog
                    attendees={attendees}
                    count={rsvpCount}
                    friendIds={new Set(friendsAttending.map((f) => f.id))}
                  />
                </div>
              ) : null}
            </div>
          )}

          {onRsvpToggle && (
            <Button
              variant={isRsvped ? "cerulean" : "coral"}
              size="sm"
              aria-pressed={isRsvped}
              onClick={(e) => {
                e.preventDefault();
                logInteraction({
                  itemId: id,
                  interactionType: "rsvp",
                  metadata: { source, position },
                });
                onRsvpToggle();
                // Confirm the action explicitly — the label flip alone was easy
                // to miss, especially far down the feed.
                if (isRsvped) {
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
      )}
    </div>
  );
}
