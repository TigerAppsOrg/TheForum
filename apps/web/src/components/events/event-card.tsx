"use client";

import { Bookmark, BookmarkCheck, Clock, MapPin, Maximize2, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { logInteraction } from "~/actions/interactions";
import { EventCoverArt } from "~/components/events/event-cover-art";
import { AvatarStack } from "~/components/social/avatar-stack";

export const CATEGORY_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  art: { bg: "rgba(255,156,133,0.1)", accent: "#fb923c", text: "#9a3412" },
  tech: { bg: "rgba(162,239,240,0.15)", accent: "#a78bfa", text: "#5b21b6" },
  music: { bg: "rgba(254,232,130,0.15)", accent: "#fbbf24", text: "#854d0e" },
  sports: { bg: "rgba(162,239,240,0.15)", accent: "#60a5fa", text: "#1e3a8a" },
  social: { bg: "rgba(255,211,234,0.2)", accent: "#f472b6", text: "#9d174d" },
  career: { bg: "rgba(162,239,240,0.15)", accent: "#34d399", text: "#065f46" },
  "free-food": { bg: "rgba(255,156,133,0.1)", accent: "#FF7151", text: "#991b1b" },
  academic: { bg: "rgba(162,239,240,0.15)", accent: "#0A9CD5", text: "#0c4a6e" },
  cultural: { bg: "rgba(254,232,130,0.15)", accent: "#f59e0b", text: "#78350f" },
  workshop: { bg: "rgba(162,239,240,0.15)", accent: "#14b8a6", text: "#134e4a" },
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
  rsvpCount: number;
  friendsAttending: { id: string; displayName: string; avatarUrl?: string | null }[];
  isSaved: boolean;
  isRsvped?: boolean;
  onSaveToggle?: () => void;
  onRsvpToggle?: () => void;
  onShare?: () => void;
  onHide?: () => void;
  /** Where this card is displayed — logged with interactions */
  source?: "feed" | "search" | "map" | "similar" | "notification";
  /** Position in the list — for position bias correction */
  position?: number;
}

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
  flyerUrl,
  rsvpCount,
  friendsAttending,
  isSaved,
  isRsvped,
  onSaveToggle,
  onRsvpToggle,
  onShare,
  onHide,
  source = "feed",
  position,
}: EventCardProps) {
  const color = getCategoryColor(tags);
  const cardRef = useRef<HTMLDivElement>(null);

  const displayedFriendNames = friendsAttending.slice(0, 2).map((friend) => friend.displayName);
  const remainingFriends = friendsAttending.length - displayedFriendNames.length;
  const friendsText =
    displayedFriendNames.length === 0
      ? ""
      : displayedFriendNames.length === 1
        ? `${displayedFriendNames[0]} is also going to this event.`
        : displayedFriendNames.length === 2 && remainingFriends === 0
          ? `${displayedFriendNames[0]} and ${displayedFriendNames[1]} are also going to this event.`
          : `${displayedFriendNames.join(", ")} + ${remainingFriends} more are also going to this event.`;

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

  return (
    <div
      ref={cardRef}
      className="flex flex-col gap-0.5 card rounded-xl overflow-hidden relative group px-5 py-5 w-5/12"
    >
      {/* Expand, Save & Share */}
      <div className="flex flex-row justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              logInteraction({
                itemId: id,
                interactionType: "save",
                metadata: { source, position },
              });
              onSaveToggle?.();
            }}
            className="icon p-0.5 hover:text-forum-dark-gray transition-color"
          >
            {isSaved ? (
              <BookmarkCheck size={15} className="text-forum-cerulean" />
            ) : (
              <Bookmark size={15} className="icon" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              logInteraction({
                itemId: id,
                interactionType: "share",
                metadata: { source, position },
              });
              onShare?.();
            }}
            className="icon"
          >
            <Share2 size={13} className="icon" />
          </button>
        </div>
        {/* Expand button */}
        <div className="relative z-10 flex items-center gap-0.25 justify-end">
          <Link href={`/events/${id}`} onClick={trackClick} className="icon">
            <Maximize2 size={16} />
          </Link>
        </div>
      </div>
      <div className="flex py-5 gap-3">
        {/* Content */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {/* Org */}
          {orgName && (
            <div className="flex items-center gap-3">
              <div className="w-[24px] h-[24px] rounded-[4px] border-[2px] border-forum-medium-gray overflow-hidden shrink-0 bg-gray-100">
                {orgLogoUrl ? (
                  <img src={orgLogoUrl} alt={orgName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-forum-turquoise/30" />
                )}
              </div>
              <p className="text-[12px] text-forum-dark-gray">
                <span className="font-medium">from </span>
                {orgId ? (
                  <Link
                    href={`/orgs/${orgId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold hover:text-forum-cerulean transition-colors duration-300ms"
                  >
                    {orgName}
                  </Link>
                ) : (
                  <span className="font-bold">{orgName}</span>
                )}
              </p>
            </div>
          )}

          {/* Title */}
          <Link href={`/events/${id}`} onClick={trackClick}>
            <h3 className="font-serif text-[18px] leading-[1.2] text-black line-clamp-2 hover:underline">
              {title}
            </h3>
          </Link>

          {/* Location & Time */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <MapPin size={11} className="text-forum-dark-gray shrink-0" />
              <span className="text-[12px] text-forum-dark-gray">{location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={11} className="text-forum-dark-gray shrink-0" />
              <span className="text-[12px] text-forum-dark-gray">{datetime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Tags + RSVP */}
      <div className="flex flex-col gap-3">
        {/* Tags */}
        <div className="flex flex-wrap">
          <div className="flex items-start gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-[8px] py-[1px] rounded-[10px] text-[12px] font-dm-sans text-black"
                style={{ background: "rgba(254,232,130,0.5)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Friends Attending */}
        <div className="flex flex-row items-center gap-2">
          {friendsAttending.length > 0 && (
            <div className="ml-1">
              <AvatarStack users={friendsAttending} size={30} />
            </div>
          )}
          {friendsText ? (
            <p className="text-[12px] text-forum-dark-gray mt-2 leading-tight">
              {displayedFriendNames.length > 0 && (
                <>
                  <span className="font-bold text-forum-coral">
                    {displayedFriendNames.join(
                      displayedFriendNames.length === 2 && remainingFriends === 0 ? " and " : ", ",
                    )}
                  </span>
                  {remainingFriends > 0 && (
                    <span className="text-forum-dark-gray"> + {remainingFriends} more</span>
                  )}
                  <span className="text-forum-dark-gray"> are also going to this event.</span>
                </>
              )}
            </p>
          ) : null}
        </div>

        {/* Description */}
        <div>
          {description && (
            <div className="overflow-hidden">
              <p className="text-[12px] text-black font-dm-sans leading-relaxed line-clamp-3">
                {description}
              </p>
            </div>
          )}
        </div>

        {/* RSVP */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              logInteraction({
                itemId: id,
                interactionType: "rsvp",
                metadata: { source, position },
              });
              onRsvpToggle?.();
            }}
            className={`self-end w-fit button-coral ${
              isRsvped
                ? "bg-forum-dark-gray text-white"
                : "bg-forum-coral/90 text-white transition-colors duration-400 hover:bg-forum-coral"
            }`}
          >
            {isRsvped ? "RSVP'D" : "RSVP"}
          </button>
        </div>
      </div>
    </div>
  );
}
