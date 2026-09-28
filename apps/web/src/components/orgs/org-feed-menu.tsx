"use client";

import { Eye, EyeOff, Heart, HeartOff, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { blockOrg, unblockOrg } from "~/actions/orgs";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

/**
 * The "⋯" menu on event cards and the event page: follow/unfollow the host
 * org (hoists it in the feed) or hide its events (removes them from
 * discovery). Render it only for events that have an org.
 */
export function EventOrgMenu({
  orgName,
  isFollowing,
  isHidden = false,
  onToggleFollow,
  onHide,
  onUnhide,
  variant = "ghost",
  className,
  iconClassName,
}: {
  orgName: string;
  isFollowing: boolean;
  /** Already hidden (the event page only — hidden orgs never reach a feed card). */
  isHidden?: boolean;
  onToggleFollow: () => void;
  onHide: () => void;
  onUnhide?: () => void;
  /** `outline` beside the event page's other outline buttons; `ghost` on cards. */
  variant?: "ghost" | "outline";
  className?: string;
  iconClassName?: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon-sm"
          aria-label={`More options for events from ${orgName}`}
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
        <DropdownMenuItem onSelect={onToggleFollow}>
          {isFollowing ? <HeartOff aria-hidden /> : <Heart aria-hidden />}
          <span className="truncate">
            {isFollowing ? "Unfollow" : "Follow"} {orgName}
          </span>
        </DropdownMenuItem>
        {isHidden && onUnhide ? (
          <DropdownMenuItem onSelect={onUnhide}>
            <Eye aria-hidden />
            <span className="truncate">Show events from {orgName}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onHide}>
            <EyeOff aria-hidden />
            <span className="truncate">Hide events from {orgName}</span>
          </DropdownMenuItem>
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

/** Class for the menu trigger inside hover-revealed utility rows: stays visible while open. */
export const menuTriggerRevealClass = cn(
  "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
  "data-[state=open]:opacity-100",
);
