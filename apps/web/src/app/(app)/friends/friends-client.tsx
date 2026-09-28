"use client";

import { Check, Clock, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type FriendProfile,
  type FriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from "~/actions/friends";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState, LoadingState } from "~/components/common/states";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { classYearShort } from "~/lib/profile-options";
import { cn } from "~/lib/utils";

function Avatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const initial = name[0]?.toUpperCase() ?? "?";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-forum-turquoise/40 font-bold text-black"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initial}
    </div>
  );
}

interface FriendsClientProps {
  initialFriends: FriendProfile[];
  initialPending: {
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
  };
}

export function FriendsClient({ initialFriends, initialPending }: FriendsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [friends, setFriends] = useState(initialFriends);
  const [pending, setPending] = useState(initialPending);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(
    new Set(initialPending.outgoing.map((r) => r.id)),
  );
  const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const friendIds = new Set(friends.map((f) => f.id));

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearchResults(await searchUsers(query));
      } catch {
        setSearchResults([]);
        toast.error("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  /** Run a server action; on failure undo the optimistic change and say so. */
  const run = (action: () => Promise<unknown>, undo: () => void, message: string) => {
    startTransition(async () => {
      try {
        await action();
      } catch {
        undo();
        toast.error(message);
      }
    });
  };

  const handleSendRequest = (userId: string) => {
    setSentIds((prev) => new Set([...prev, userId]));
    run(
      () => sendFriendRequest(userId),
      () =>
        setSentIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        }),
      "Couldn't send the request.",
    );
  };

  const handleAccept = (fromUserId: string) => {
    const snapshot = { pending, friends };
    const accepted = pending.incoming.find((r) => r.id === fromUserId);
    setPending((prev) => ({ ...prev, incoming: prev.incoming.filter((r) => r.id !== fromUserId) }));
    if (accepted) {
      setFriends((prev) => [
        ...prev,
        {
          id: accepted.id,
          displayName: accepted.displayName,
          netId: accepted.netId,
          avatarUrl: accepted.avatarUrl,
          classYear: null,
          major: null,
        },
      ]);
    }
    run(
      () => acceptFriendRequest(fromUserId),
      () => {
        setPending(snapshot.pending);
        setFriends(snapshot.friends);
      },
      "Couldn't accept the request.",
    );
  };

  const handleDecline = (fromUserId: string) => {
    const snapshot = pending;
    setPending((prev) => ({ ...prev, incoming: prev.incoming.filter((r) => r.id !== fromUserId) }));
    run(
      () => declineFriendRequest(fromUserId),
      () => setPending(snapshot),
      "Couldn't decline the request.",
    );
  };

  const handleRemove = (friendId: string) => {
    const snapshot = friends;
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    run(
      () => removeFriend(friendId),
      () => setFriends(snapshot),
      "Couldn't remove that friend.",
    );
  };

  const tabs = [
    { id: "friends" as const, label: "Friends", count: friends.length },
    { id: "requests" as const, label: "Requests", count: pending.incoming.length },
  ];

  const isSearchActive = searchQuery.trim().length > 0;
  const LIST =
    "divide-y divide-forum-border overflow-hidden rounded-lg border border-forum-border bg-white";
  const ROW = "flex items-center gap-3 px-3 py-2 sm:px-4";

  const person = (p: {
    displayName: string;
    netId: string;
    avatarUrl?: string | null;
    classYear?: string | null;
  }) => (
    <>
      <Avatar name={p.displayName} avatarUrl={p.avatarUrl} />
      <div className="min-w-0 flex-1 font-dm-sans">
        <p className="truncate text-[14px] font-semibold text-black">{p.displayName}</p>
        <p className="truncate text-[12px] text-forum-light-gray">
          @{p.netId}
          {classYearShort(p.classYear) && ` · ${classYearShort(p.classYear)}`}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search is always here — it's how you find people to add. */}
      <SearchInput
        label="Find people by name or NetID"
        placeholder="Find people by name or NetID"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="h-10"
      />

      {isSearchActive ? (
        isSearching ? (
          <LoadingState label="Searching…" className="py-6" />
        ) : searchResults.length > 0 ? (
          <ul className={LIST}>
            {searchResults.map((user) => {
              const isFriend = friendIds.has(user.id);
              const isPendingSent = sentIds.has(user.id);
              return (
                <li key={user.id} className={ROW}>
                  {person(user)}
                  {isFriend ? (
                    <span className="font-dm-sans text-[12px] font-semibold text-forum-cerulean">
                      Friends
                    </span>
                  ) : isPendingSent ? (
                    <span className="flex items-center gap-1 font-dm-sans text-[12px] text-forum-light-gray">
                      <Clock size={12} aria-hidden /> Requested
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-7 rounded-full px-3 text-[12px]"
                      onClick={() => handleSendRequest(user.id)}
                    >
                      <UserPlus />
                      Add
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Search}
            title="No one found"
            description="Try a different name or NetID."
          />
        )
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-4 border-b border-forum-border"
          >
            {tabs.map(({ id, label, count }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex-none px-0.5 py-2 font-dm-sans text-[13px] font-semibold text-forum-light-gray after:bottom-[-1px] after:h-0.5 after:bg-forum-cerulean data-[state=active]:text-black"
              >
                {label}
                <span
                  className={cn(
                    "ml-1 font-normal",
                    id === "requests" && count > 0
                      ? "font-semibold text-forum-coral"
                      : "text-forum-light-gray",
                  )}
                >
                  {count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="friends" className="mt-3">
            {friends.length > 0 ? (
              <ul className={LIST}>
                {friends.map((friend) => (
                  <li key={friend.id} className={ROW}>
                    {person(friend)}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${friend.displayName} from friends`}
                      onClick={() => handleRemove(friend.id)}
                      className="text-forum-light-gray hover:bg-forum-coral/10 hover:text-forum-coral"
                    >
                      <UserMinus />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Users}
                title="No friends yet"
                description="Search above to find classmates by name or NetID."
              />
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-3">
            {pending.incoming.length > 0 ? (
              <ul className={LIST}>
                {pending.incoming.map((req) => (
                  <li key={req.id} className={cn(ROW, "flex-wrap")}>
                    {person(req)}
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="cerulean"
                        size="xs"
                        className="h-7 rounded-full px-3 text-[12px]"
                        onClick={() => handleAccept(req.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 rounded-full px-3 text-[12px]"
                        onClick={() => handleDecline(req.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Check}
                title="All caught up"
                description="No pending friend requests."
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
