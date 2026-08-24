"use client";

import { CalendarDays, ChevronLeft, Heart, MapPin, Shield, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { type FriendProfile, searchUsers } from "~/actions/friends";
import { type OrgDetail, addOfficer, removeOfficer, toggleFollowOrg } from "~/actions/orgs";
import { Panel } from "~/components/common/panel";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState } from "~/components/common/states";
import { getCategoryColor } from "~/components/events/event-card";
import { PageHeading, PageShell, SectionHeading } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";

function colorFromString(str: string) {
  const colors = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#22c55e", "#3b82f6"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length] ?? "#6366f1";
}

interface OrgProfileClientProps {
  org: OrgDetail;
}

export function OrgProfileClient({ org }: OrgProfileClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useState(org.isFollowing);
  const [followerCount, setFollowerCount] = useState(org.followerCount);

  const handleToggleFollow = () => {
    setIsFollowing(!isFollowing);
    setFollowerCount((c) => (isFollowing ? c - 1 : c + 1));
    startTransition(async () => {
      const result = await toggleFollowOrg(org.id);
      setIsFollowing(result.following);
    });
  };

  const [members, setMembers] = useState(org.members);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const owners = members.filter((m) => m.role === "owner");
  const officers = members.filter((m) => m.role === "officer");
  const memberIds = new Set(members.map((m) => m.id));

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const results = await searchUsers(query);
      setSearchResults(results.filter((u) => !memberIds.has(u.id)));
      setIsSearching(false);
    },
    [memberIds],
  );

  const handleAddOfficer = (user: FriendProfile) => {
    startTransition(async () => {
      await addOfficer(org.id, user.id);
      setMembers((prev) => [
        ...prev,
        { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, role: "officer" },
      ]);
      setSearchQuery("");
      setSearchResults([]);
      toast.success(`${user.displayName} added as officer`);
    });
  };

  const handleRemoveOfficer = (userId: string, name: string) => {
    startTransition(async () => {
      await removeOfficer(org.id, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      toast.success(`${name} removed`);
    });
  };

  return (
    <PageShell>
      {/* Back */}
      <Button variant="quiet" size="sm" onClick={() => router.back()} className="mb-6">
        <ChevronLeft />
        Back
      </Button>

      {/* Header */}
      <Panel size="none" className="mb-8 overflow-hidden">
        <div
          aria-hidden
          className="flex h-28 items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${colorFromString(org.name)}20, ${colorFromString(org.name)}40)`,
          }}
        >
          {org.logoUrl ? (
            <img src={org.logoUrl} alt="" className="size-16 rounded-xl object-cover shadow-md" />
          ) : (
            <span className="text-4xl font-black" style={{ color: colorFromString(org.name) }}>
              {org.name[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="p-6">
          <PageHeading
            className="text-[28px] sm:text-[32px] lg:text-[36px]"
            description={<span className="capitalize">{org.category}</span>}
            action={
              <Button
                variant={isFollowing ? "soft" : "cerulean"}
                aria-pressed={isFollowing}
                disabled={isPending}
                onClick={handleToggleFollow}
                className="rounded-full"
              >
                <Heart fill={isFollowing ? "currentColor" : "none"} />
                {isFollowing ? "Following" : "Follow"}
              </Button>
            }
          >
            {org.name}
          </PageHeading>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-dm-sans text-sm text-forum-dark-gray">
              <Users size={14} aria-hidden className="text-forum-light-gray" />
              {followerCount} follower{followerCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5 font-dm-sans text-sm text-forum-dark-gray">
              <CalendarDays size={14} aria-hidden className="text-forum-light-gray" />
              {org.upcomingEvents.length} upcoming event{org.upcomingEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {org.description && (
            <p className="mt-4 whitespace-pre-wrap font-dm-sans text-sm leading-relaxed text-forum-dark-gray">
              {org.description}
            </p>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left: Events */}
        <section className="md:col-span-2">
          <SectionHeading>Upcoming Events</SectionHeading>
          {org.upcomingEvents.length > 0 ? (
            <div className="flex flex-col gap-3">
              {org.upcomingEvents.map((event) => {
                const color = getCategoryColor(event.tags);
                return (
                  <Panel
                    asChild
                    key={event.id}
                    size="sm"
                    className="transition-colors hover:border-forum-cerulean"
                  >
                    <Link href={`/events/${event.id}`} className="flex items-center gap-4">
                      <div
                        aria-hidden
                        className="flex size-12 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: color.bg }}
                      >
                        <CalendarDays size={16} style={{ color: color.text }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-dm-sans text-sm font-semibold text-black">
                          {event.title}
                        </p>
                        <p className="mt-0.5 font-dm-sans text-xs text-forum-light-gray">
                          {event.datetime}
                          <span className="mx-1.5">·</span>
                          <MapPin size={10} aria-hidden className="-mt-0.5 inline" />{" "}
                          {event.locationName}
                        </p>
                      </div>
                    </Link>
                  </Panel>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No upcoming events" />
          )}
        </section>

        {/* Right: Members */}
        <section>
          <SectionHeading>Team</SectionHeading>
          <Panel size="none" className="divide-y divide-forum-medium-gray">
            {[...owners, ...officers].map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: colorFromString(member.displayName) }}
                >
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt=""
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    member.displayName[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-dm-sans text-sm font-medium text-black">
                    {member.displayName}
                  </p>
                </div>
                <span className="flex items-center gap-1 font-dm-sans text-[10px] font-medium uppercase tracking-wider text-forum-light-gray">
                  {member.role === "owner" && (
                    <Shield size={10} aria-hidden className="text-forum-yellow" />
                  )}
                  {member.role}
                </span>
                {org.isOwner && member.role === "officer" && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${member.displayName} as officer`}
                    disabled={isPending}
                    onClick={() => handleRemoveOfficer(member.id, member.displayName)}
                    className="text-forum-light-gray hover:text-forum-coral"
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {owners.length === 0 && officers.length === 0 && (
              <p className="p-4 text-center font-dm-sans text-xs text-forum-light-gray">
                No team members listed
              </p>
            )}
          </Panel>

          {/* Add officer search — owner only */}
          {org.isOwner && (
            <div className="mt-4">
              <SearchInput
                label="Search users to add as officers"
                placeholder="Search users to add…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <Panel size="none" className="mt-2 divide-y divide-forum-medium-gray">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 px-3 py-2">
                      <div
                        aria-hidden
                        className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: colorFromString(user.displayName) }}
                      >
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt=""
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          user.displayName[0]?.toUpperCase()
                        )}
                      </div>
                      <span className="flex-1 truncate font-dm-sans text-sm text-black">
                        {user.displayName}
                      </span>
                      <Button
                        variant="quiet"
                        size="xs"
                        disabled={isPending}
                        onClick={() => handleAddOfficer(user)}
                        className="text-forum-cerulean"
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </Panel>
              )}
              {isSearching && (
                <p className="mt-2 px-1 font-dm-sans text-xs text-forum-light-gray">Searching…</p>
              )}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
