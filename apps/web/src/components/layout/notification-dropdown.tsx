"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { acceptFriendRequest, declineFriendRequest } from "~/actions/friends";
import {
  type NotificationItem,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "~/actions/notifications";
import { ErrorState } from "~/components/common/states";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { formatTimeAgo } from "~/lib/date-format";
import { cn } from "~/lib/utils";

/** getNotifications returns at most this many (see actions/notifications.ts). */
const NOTIFICATION_PAGE_SIZE = 20;

export function NotificationDropdown() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const [loadFailed, setLoadFailed] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setLoadFailed(false);
    } catch {
      /*
       * Recorded rather than swallowed. This polls on a 60s interval, so a
       * toast per failure would be spam — the dropdown says so instead, and
       * only when you open it.
       */
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    const previous = items;
    const previousCount = unreadCount;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      setItems(previous);
      setUnreadCount(previousCount);
      toast.error("Couldn't mark notifications as read.");
    }
  };

  const handleAccept = async (n: NotificationItem) => {
    const fromUserId = n.payload.fromUserId as string | undefined;
    try {
      if (fromUserId) await acceptFriendRequest(fromUserId);
      toast.success("Friend request accepted");
    } catch {
      toast.error("Couldn't accept the request. Please try again.");
      return;
    }
    handleMarkRead(n.id);
  };

  const handleDecline = async (n: NotificationItem) => {
    const fromUserId = n.payload.fromUserId as string | undefined;
    try {
      if (fromUserId) await declineFriendRequest(fromUserId);
    } catch {
      toast.error("Couldn't decline the request. Please try again.");
      return;
    }
    handleMarkRead(n.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="p-2 rounded-full hover:bg-forum-turquoise/20 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
        >
          <Bell size={20} aria-hidden className="text-forum-dark-gray" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-forum-coral text-white text-[9px] font-bold px-1 ring-2 ring-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        // Caps to the viewport on phones — a fixed 460px overflowed a 375px screen.
        className="w-[calc(100vw-2rem)] max-w-[460px] rounded-[16px] border border-forum-border p-0 shadow-[0px_8px_30px_rgba(0,0,0,0.12)] sm:w-[460px]"
      >
        {/* Header — italic serif title */}
        <div className="px-[24px] pt-[24px] pb-[16px]">
          <h3 className="font-serif italic text-[28px] text-black leading-none">Notifications</h3>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto px-[16px]">
          {items.length > 0 ? (
            items.map((n) => (
              <NotificationRow
                key={n.id}
                item={n}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onMarkRead={handleMarkRead}
                onNavigate={(path) => {
                  setOpen(false);
                  router.push(path);
                }}
              />
            ))
          ) : loadFailed ? (
            /* An empty list and a failed fetch mean very different things. */
            <ErrorState
              title="Couldn't load notifications"
              description="Check your connection and try again."
              onRetry={fetchNotifications}
            />
          ) : (
            <div className="py-[50px] text-center">
              <Bell size={28} aria-hidden className="text-forum-medium-gray mx-auto mb-3" />
              <p className="text-[14px] font-dm-sans text-forum-light-gray">No notifications yet</p>
            </div>
          )}
        </div>

        {/*
          Footer. "View older notifications" used to live here but only
          re-fetched the same 20 rows; marking everything read is real.
        */}
        {items.length > 0 && (
          <div className="px-[24px] py-[16px] flex flex-col items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-[20px] py-[8px] rounded-[20px] border border-forum-medium-gray text-[11px] font-bold font-dm-sans text-forum-dark-gray tracking-[0.1em] hover:border-forum-dark-gray transition-colors"
              >
                MARK ALL AS READ
              </button>
            )}
            {items.length >= NOTIFICATION_PAGE_SIZE && (
              <p className="text-[11px] font-dm-sans text-forum-light-gray">
                Showing your {NOTIFICATION_PAGE_SIZE} most recent notifications
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Individual notification row ── */

function NotificationRow({
  item,
  onAccept,
  onDecline,
  onMarkRead,
  onNavigate,
}: {
  item: NotificationItem;
  onAccept: (n: NotificationItem) => void;
  onDecline: (n: NotificationItem) => void;
  onMarkRead: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const isFriendRequest = item.type === "friend_request";
  const isEventNotif = item.type === "event_reminder" || item.type === "org_new_event";

  /* Avatar: circle for people, rounded-square for orgs/events */
  const avatarInitial = isFriendRequest
    ? ((item.payload.fromDisplayName as string)?.[0]?.toUpperCase() ?? "?")
    : ((item.payload.eventTitle as string)?.[0]?.toUpperCase() ??
      (item.payload.orgName as string)?.[0]?.toUpperCase() ??
      "?");

  const isCircle = isFriendRequest;

  /* Text content */
  let boldText = "";
  let restText = "";

  if (item.type === "friend_request") {
    const name = (item.payload.fromDisplayName as string) ?? "Someone";
    const netId = (item.payload.fromNetId as string) ?? "";
    boldText = netId ? `${name} (${netId})` : name;
    // Read ≠ accepted: this used to claim they'd accepted *your* request.
    restText = " sent you a friend request.";
  } else if (item.type === "event_reminder") {
    // Generated for RSVPs starting within 24h — which may be today, not tomorrow.
    boldText = (item.payload.eventTitle as string) ?? "An event";
    restText = " starts within a day — you're going!";
  } else if (item.type === "org_new_event") {
    boldText =
      (item.payload.eventTitle as string) ?? (item.payload.orgName as string) ?? "An event";
    restText = " was just posted by an organization you follow.";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-[14px] py-[14px] px-[8px] rounded-[10px] transition-colors",
        !item.read && "bg-forum-turquoise/5",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-[56px] h-[56px] flex-shrink-0 overflow-hidden flex items-center justify-center text-[18px] font-bold",
          isCircle
            ? "rounded-full border-[3px] border-forum-medium-gray bg-forum-turquoise/20 text-black"
            : "rounded-[8px] border-[2px] border-forum-medium-gray bg-forum-dark-gray/10 text-forum-dark-gray",
        )}
      >
        {avatarInitial}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-dm-sans text-black leading-snug">
          <span className="font-bold">{boldText}</span>
          {restText}
        </p>
        <p className="text-[12px] font-dm-sans text-forum-light-gray mt-[3px]">
          {formatTimeAgo(new Date(item.createdAt))}
        </p>
      </div>

      {/* Actions */}
      {isFriendRequest && !item.read && (
        <div className="flex flex-col gap-[6px] flex-shrink-0">
          <button
            type="button"
            onClick={() => onAccept(item)}
            className="px-[14px] py-[5px] rounded-[16px] bg-forum-cerulean text-white text-[11px] font-bold tracking-wider hover:opacity-90 transition-opacity"
          >
            ACCEPT
          </button>
          <button
            type="button"
            onClick={() => onDecline(item)}
            className="px-[14px] py-[5px] rounded-[16px] border border-forum-medium-gray text-[11px] font-bold text-forum-light-gray tracking-wider hover:border-forum-dark-gray transition-colors"
          >
            DECLINE
          </button>
        </div>
      )}
      {isEventNotif && (
        <button
          type="button"
          onClick={() => {
            onMarkRead(item.id);
            const eventId = item.payload.eventId as string | undefined;
            if (eventId) onNavigate(`/events/${eventId}`);
          }}
          className="px-[14px] py-[6px] rounded-[16px] border border-forum-medium-gray text-[11px] font-bold text-forum-light-gray tracking-wider hover:border-forum-dark-gray transition-colors flex-shrink-0"
        >
          DETAILS
        </button>
      )}
    </div>
  );
}
