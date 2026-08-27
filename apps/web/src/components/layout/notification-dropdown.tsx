"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { acceptFriendRequest, declineFriendRequest } from "~/actions/friends";
import {
  type NotificationItem,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "~/actions/notifications";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

function formatTimeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationDropdown() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(20);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // silently fail
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

  const handleAccept = async (n: NotificationItem) => {
    const fromUserId = n.payload.fromUserId as string | undefined;
    if (fromUserId) {
      await acceptFriendRequest(fromUserId);
    }
    handleMarkRead(n.id);
  };

  const handleDecline = async (n: NotificationItem) => {
    const fromUserId = n.payload.fromUserId as string | undefined;
    if (fromUserId) {
      await declineFriendRequest(fromUserId);
    }
    handleMarkRead(n.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-full hover:bg-forum-turquoise/20 transition-colors relative"
        >
          <Bell size={20} className="text-forum-dark-gray" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-forum-coral text-white text-[9px] font-bold px-1 ring-2 ring-white">
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
          ) : (
            <div className="py-[50px] text-center">
              <Bell size={28} className="text-forum-medium-gray mx-auto mb-3" />
              <p className="text-[14px] font-dm-sans text-forum-light-gray">No notifications yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-[24px] py-[16px] flex justify-center">
            <button
              type="button"
              onClick={() => {
                setLimit((prev) => prev + 20);
                fetchNotifications();
              }}
              className="px-[20px] py-[8px] rounded-[20px] border border-forum-medium-gray text-[11px] font-bold font-dm-sans text-forum-dark-gray tracking-[0.1em] hover:border-forum-dark-gray transition-colors"
            >
              VIEW OLDER NOTIFICATIONS
            </button>
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
    restText = item.read ? " accepted your friend request" : " sent you a friend request.";
  } else if (item.type === "event_reminder") {
    boldText = (item.payload.eventTitle as string) ?? "An event";
    restText = " is happening tomorrow!";
  } else if (item.type === "org_new_event") {
    boldText =
      (item.payload.eventTitle as string) ?? (item.payload.orgName as string) ?? "An event";
    restText = " is happening soon!";
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
          {formatTimeAgo(item.createdAt)}
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
