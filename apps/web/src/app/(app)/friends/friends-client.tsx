"use client";

import { Check, Clock, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import {
  type FriendProfile,
  type FriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from "~/actions/friends";
import { Panel } from "~/components/common/panel";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState, LoadingState } from "~/components/common/states";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

function Avatar({
  name,
  avatarUrl,
  size = 56,
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
        className="shrink-0 rounded-md border-2 border-forum-medium-gray object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md border-2 border-forum-medium-gray bg-forum-turquoise/30 font-bold text-black"
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
  const [activeTab, setActiveTab] = useState<"friends" | "find" | "requests">("friends");
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
      const results = await searchUsers(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }, []);

  const handleSendRequest = (userId: string) => {
    setSentIds((prev) => new Set([...prev, userId]));
    startTransition(async () => {
      await sendFriendRequest(userId);
    });
  };

  const handleAccept = (fromUserId: string) => {
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
    startTransition(async () => {
      await acceptFriendRequest(fromUserId);
    });
  };

  const handleDecline = (fromUserId: string) => {
    setPending((prev) => ({ ...prev, incoming: prev.incoming.filter((r) => r.id !== fromUserId) }));
    startTransition(async () => {
      await declineFriendRequest(fromUserId);
    });
  };

  const handleRemove = (friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    startTransition(async () => {
      await removeFriend(friendId);
    });
  };

  const tabs = [
    { id: "friends" as const, label: "Your Friends", count: friends.length },
    { id: "find" as const, label: "Find New Friends", count: 0 },
    { id: "requests" as const, label: "Requests", count: pending.incoming.length },
  ];

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      className="gap-6"
    >
      <TabsList variant="line" className="h-auto w-full border-b border-forum-medium-gray">
        {tabs.map(({ id, label, count }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="flex-1 py-4 font-dm-sans text-[16px] font-semibold after:bottom-[-1px] after:h-0.5 after:bg-forum-cerulean data-[state=active]:text-black"
          >
            {label}
            {count > 0 && (
              <span className="ml-2 rounded-full bg-forum-coral/10 px-2 py-0.5 text-[12px] font-bold text-forum-coral">
                {count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <SearchInput
        label="Search users by name or NetID"
        placeholder="Search users by name or NetID"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {/*
        Search results replace the active tab's content rather than sitting on
        top of it, so only one list is ever on screen.
      */}
      {isSearchActive ? (
        <Panel size="none" className="overflow-hidden">
          {isSearching ? (
            <LoadingState label="Searching…" />
          ) : searchResults.length > 0 ? (
            <ul>
              {searchResults.map((user) => {
                const isFriend = friendIds.has(user.id);
                const isPendingSent = sentIds.has(user.id);
                return (
                  <li
                    key={user.id}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-forum-turquoise/10"
                  >
                    <Avatar name={user.displayName} avatarUrl={user.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-dm-sans text-[15px] font-bold text-black">
                        {user.displayName}
                      </p>
                      <p className="font-dm-sans text-[12px] text-forum-light-gray">
                        @{user.netId}
                        {user.classYear && ` · '${user.classYear.slice(-2)}`}
                      </p>
                    </div>
                    {isFriend ? (
                      <span className="font-dm-sans text-[12px] font-bold text-forum-cerulean">
                        Friends
                      </span>
                    ) : isPendingSent ? (
                      <span className="flex items-center gap-1 font-dm-sans text-[12px] font-bold text-forum-light-gray">
                        <Clock size={12} aria-hidden /> Sent
                      </span>
                    ) : (
                      <Button
                        variant="cerulean"
                        size="sm"
                        disabled={isPending}
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
              title="No users found"
              description="Try a different name or NetID."
            />
          )}
        </Panel>
      ) : (
        <>
          <TabsContent value="friends">
            {friends.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {friends.map((friend) => (
                  <Panel
                    key={friend.id}
                    size="sm"
                    className="group flex items-center gap-4 transition-colors hover:border-forum-cerulean"
                  >
                    <Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-dm-sans text-[15px] font-bold text-black">
                        {friend.displayName}
                      </p>
                      <p className="font-dm-sans text-[12px] text-forum-light-gray">
                        @{friend.netId}
                        {friend.classYear && ` · '${friend.classYear.slice(-2)}`}
                      </p>
                    </div>
                    {/*
                      Kept reachable by keyboard: the control is always in the
                      tab order and reveals itself on focus, not just on hover.
                    */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${friend.displayName} from friends`}
                      onClick={() => handleRemove(friend.id)}
                      className="text-forum-medium-gray opacity-0 transition-opacity hover:text-forum-coral focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <UserMinus />
                    </Button>
                  </Panel>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No friends yet"
                description="Search for classmates to start connecting."
              />
            )}
          </TabsContent>

          <TabsContent value="find">
            <EmptyState
              icon={Search}
              title="Find your classmates"
              description="Use the search bar above to find people by name or NetID."
            />
          </TabsContent>

          <TabsContent value="requests">
            {pending.incoming.length > 0 ? (
              <div className="flex flex-col gap-3">
                {pending.incoming.map((req) => (
                  <Panel key={req.id} size="sm" className="flex items-center gap-4">
                    <Avatar name={req.displayName} avatarUrl={req.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="font-dm-sans text-[15px] text-black">
                        <span className="font-bold">{req.displayName}</span> ({req.netId}) sent you
                        a friend request.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="cerulean"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleAccept(req.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDecline(req.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </Panel>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Check}
                title="All caught up"
                description="No pending friend requests."
              />
            )}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
