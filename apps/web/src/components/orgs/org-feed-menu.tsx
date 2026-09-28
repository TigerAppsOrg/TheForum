"use client";

import { Eye, EyeOff, Heart, HeartOff, MoreHorizontal, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { blockOrg, unblockOrg } from "~/actions/orgs";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/**
 * The one "⋯" menu for an event, on feed cards and the event page:
 *  1. "Not interested in this event" — the per-event hide (cards only);
 *  2. Follow / Unfollow <Org> — hoists the org in the feed;
 *  3. Hide events from <Org> — removes the org from discovery.
 * Org items appear only when the event has an org, so an org-less card's menu
 * holds just "Not interested". Renders nothing when there is nothing to offer.
 */
export function EventActionsMenu({
  eventTitle,
  onNotInterested,
  org,
  variant = "ghost",
  className,
  iconClassName,
}: {
  eventTitle: string;
  /** Per-event hide; omitted where events can't be hidden (the event page). */
  onNotInterested?: () => void;
  org?: {
    name: string;
    isFollowing: boolean;
    /** Already hidden (the event page only — hidden orgs never reach a feed card). */
    isHidden?: boolean;
    onToggleFollow: () => void;
    onHide: () => void;
    onUnhide?: () => void;
  } | null;
  /** `outline` beside the event page's other outline buttons; `ghost` on cards. */
  variant?: "ghost" | "outline";
  className?: string;
  iconClassName?: string;
}) {
  if (!onNotInterested && !org) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon-sm"
          aria-label={`More options for ${eventTitle}`}
          className={className}
        >
          <MoreHorizontal className={iconClassName} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-max min-w-56 max-w-[min(22rem,calc(100vw-2rem))] font-dm-sans"
      >
        {onNotInterested && (
          <DropdownMenuItem onSelect={onNotInterested}>
            <ThumbsDown aria-hidden />
            Not interested in this event
          </DropdownMenuItem>
        )}
        {onNotInterested && org && <DropdownMenuSeparator />}
        {org && (
          <>
            <DropdownMenuItem onSelect={org.onToggleFollow}>
              {org.isFollowing ? <HeartOff aria-hidden /> : <Heart aria-hidden />}
              <span className="truncate">
                {org.isFollowing ? "Unfollow" : "Follow"} {org.name}
              </span>
            </DropdownMenuItem>
            {org.isHidden && org.onUnhide ? (
              <DropdownMenuItem onSelect={org.onUnhide}>
                <Eye aria-hidden />
                <span className="truncate">Show events from {org.name}</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={org.onHide}>
                <EyeOff aria-hidden />
                <span className="truncate">Hide events from {org.name}</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hide an org, then offer Undo in a toast. `onHidden` runs immediately
 * (optimistically) and `onSaved` once the server has it; `onRestored` runs if
 * the request fails or Undo succeeds. Undo restores a follow the hide removed.
 */
export async function hideOrgWithUndo({
  orgId,
  orgName,
  onHidden,
  onSaved,
  onRestored,
  onFollowRestored,
}: {
  orgId: string;
  orgName: string;
  onHidden: () => void;
  onSaved?: () => void;
  onRestored: () => void;
  /** Undo re-followed the org (the hide had unfollowed it). */
  onFollowRestored?: () => void;
}) {
  onHidden();
  let unfollowed = false;
  try {
    ({ unfollowed } = await blockOrg(orgId));
  } catch {
    onRestored();
    toast.error(`Couldn't hide ${orgName}. Please try again.`);
    return;
  }
  onSaved?.();
  toast(`Hidden events from ${orgName}`, {
    description: "Manage hidden organizations on the Orgs page.",
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await unblockOrg(orgId, { refollow: unfollowed });
          onRestored();
          if (unfollowed) onFollowRestored?.();
        } catch {
          toast.error(`Couldn't undo. Try “Show in my feed” on ${orgName}'s page.`);
        }
      },
    },
  });
}
