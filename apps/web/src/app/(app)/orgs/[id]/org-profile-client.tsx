"use client";

import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  Shield,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { type UserSearchResult, searchUsers } from "~/actions/friends";
import { type OrgDetail, addOfficer, removeOfficer, toggleFollowOrg } from "~/actions/orgs";
import { OrgAvatar } from "~/components/common/org-avatar";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState } from "~/components/common/states";
import { EventCard } from "~/components/events/event-card";
import { PageShell } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X",
  youtube: "YouTube",
};

function PersonAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className="size-7 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="flex size-7 items-center justify-center rounded-full bg-forum-cerulean/15 font-dm-sans text-[11px] font-semibold text-forum-cerulean"
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

function LinkChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-forum-border bg-white px-3 py-1 font-dm-sans text-xs font-medium text-forum-dark-gray transition-colors hover:border-forum-cerulean hover:text-forum-cerulean"
    >
      {children}
    </a>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-forum-medium-gray pt-4 first:border-t-0 first:pt-0">
      <h2 className="font-dm-sans text-xs font-semibold uppercase tracking-wide text-forum-light-gray">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function OrgProfileClient({ org }: { org: OrgDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useState(org.isFollowing);
  const [followerCount, setFollowerCount] = useState(org.followerCount);
  const [team, setTeam] = useState(org.team);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const official = org.source === "myprincetonu";

  const handleToggleFollow = () => {
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowerCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      try {
        const result = await toggleFollowOrg(org.id);
        setIsFollowing(result.following);
      } catch {
        setIsFollowing(!next);
        setFollowerCount((c) => c + (next ? -1 : 1));
        toast.error("Couldn't update follow. Try again.");
      }
    });
  };

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      const ids = new Set(team.map((m) => m.id));
      const results = await searchUsers(query);
      setSearchResults(results.filter((u) => !ids.has(u.id)));
    },
    [team],
  );

  const handleAddOfficer = (user: UserSearchResult) => {
    startTransition(async () => {
      try {
        await addOfficer(org.id, user.id);
        setTeam((prev) => [...prev, { ...user, role: "officer" }]);
        setSearchQuery("");
        setSearchResults([]);
        toast.success(`${user.displayName} added as an officer`);
      } catch {
        toast.error("Couldn't add that officer.");
      }
    });
  };

  const handleRemoveOfficer = (userId: string, name: string) => {
    startTransition(async () => {
      try {
        await removeOfficer(org.id, userId);
        setTeam((prev) => prev.filter((m) => m.id !== userId));
        toast.success(`${name} removed`);
      } catch {
        toast.error("Couldn't remove that officer.");
      }
    });
  };

  const copyEmail = async () => {
    if (!org.contactEmail) return;
    try {
      await navigator.clipboard.writeText(org.contactEmail);
      toast.success("Email copied");
    } catch {
      toast.message(org.contactEmail);
    }
  };

  const socials = Object.entries(org.socials).filter(([k, v]) => SOCIAL_LABELS[k] && v);

  return (
    <PageShell>
      <Button variant="quiet" size="sm" onClick={() => router.back()} className="mb-4 -ml-2">
        <ChevronLeft />
        Back
      </Button>

      <header className="flex flex-col gap-4 rounded-[24px] border border-forum-border bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:p-6">
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-serif text-[26px] font-semibold leading-tight text-black text-balance sm:text-[30px]">
              {org.name}
            </h1>
            {official && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-forum-cerulean/10 px-2 py-0.5 font-dm-sans text-[11px] font-medium text-forum-cerulean"
                title="Imported from Princeton's official MyPrincetonU directory"
              >
                <BadgeCheck size={12} aria-hidden />
                MyPrincetonU
              </span>
            )}
          </div>
          <p className="font-dm-sans text-sm text-forum-dark-gray">
            {[org.acronym, org.groupType, org.category].filter(Boolean).map((part, i) => (
              <span key={part} className={i === 2 ? "capitalize" : undefined}>
                {i > 0 && <span className="px-1.5 text-forum-light-gray">·</span>}
                {part}
              </span>
            ))}
          </p>
          {org.tagline && !/^add a tagline here\.?$/i.test(org.tagline.trim()) && (
            <p className="font-dm-sans text-sm italic text-forum-dark-gray">{org.tagline}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            {org.groupUrl && (
              <LinkChip href={org.groupUrl}>
                <ExternalLink size={12} aria-hidden />
                MyPrincetonU page
              </LinkChip>
            )}
            {org.website && (
              <LinkChip href={org.website}>
                <Globe size={12} aria-hidden />
                Website
              </LinkChip>
            )}
            {socials.map(([key, url]) => (
              <LinkChip key={key} href={url}>
                {SOCIAL_LABELS[key]}
              </LinkChip>
            ))}
            {org.contactEmail && (
              <button
                type="button"
                onClick={copyEmail}
                className="inline-flex items-center gap-1.5 rounded-full border border-forum-border bg-white px-3 py-1 font-dm-sans text-xs font-medium text-forum-dark-gray transition-colors hover:border-forum-cerulean hover:text-forum-cerulean"
                title="Copy email address"
              >
                <Copy size={12} aria-hidden />
                <span className="select-all">{org.contactEmail}</span>
              </button>
            )}
          </div>
        </div>
        <Button
          variant={isFollowing ? "soft" : "cerulean"}
          aria-pressed={isFollowing}
          disabled={isPending}
          onClick={handleToggleFollow}
          className="shrink-0 rounded-full"
        >
          <Heart fill={isFollowing ? "currentColor" : "none"} />
          {isFollowing ? "Following" : "Follow"}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          {org.description && (
            <section className="flex flex-col gap-2 rounded-[24px] border border-forum-border bg-white p-5">
              <h2 className="font-dm-sans text-sm font-semibold text-black">About</h2>
              <p className="max-w-prose whitespace-pre-line font-dm-sans text-sm leading-relaxed text-forum-dark-gray">
                {org.description}
              </p>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-dm-sans text-sm font-semibold text-black">
              Upcoming events
              <span className="font-normal text-forum-light-gray">{org.upcomingEvents.length}</span>
            </h2>
            {org.upcomingEvents.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {org.upcomingEvents.map((event, index) => (
                  <EventCard
                    key={event.id}
                    id={event.id}
                    // Drafts and private events only reach this list for owners/officers.
                    title={
                      event.status === "draft"
                        ? `${event.title} (Draft)`
                        : event.isPublic
                          ? event.title
                          : `${event.title} (Private)`
                    }
                    datetime={event.datetime}
                    location={event.locationName}
                    tags={event.tags}
                    orgName={org.name}
                    orgId={org.id}
                    density="compact"
                    source="similar"
                    position={index}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming events"
                description={
                  official
                    ? "Events this group posts on MyPrincetonU or sends to campus listservs appear here automatically."
                    : undefined
                }
              />
            )}
          </section>
        </div>

        <aside className="flex h-fit flex-col gap-4 rounded-[24px] border border-forum-border bg-white p-5">
          <SideSection title="Community">
            <p className="flex items-center gap-2 font-dm-sans text-sm text-forum-dark-gray">
              <Heart size={14} aria-hidden className="text-forum-light-gray" />
              {followerCount} {followerCount === 1 ? "follower" : "followers"} on The Forum
            </p>
            {org.memberCount ? (
              <p className="flex items-center gap-2 font-dm-sans text-sm text-forum-dark-gray">
                <Users size={14} aria-hidden className="text-forum-light-gray" />
                {org.memberCount} members on MyPrincetonU
              </p>
            ) : null}
          </SideSection>

          {org.friendsFollowing.length > 0 && (
            <SideSection title="Friends who follow">
              <ul className="flex flex-col gap-2">
                {org.friendsFollowing.map((friend) => (
                  <li key={friend.id} className="flex items-center gap-2">
                    <PersonAvatar name={friend.displayName} avatarUrl={friend.avatarUrl} />
                    <span className="truncate font-dm-sans text-sm text-black">
                      {friend.displayName}
                    </span>
                  </li>
                ))}
              </ul>
            </SideSection>
          )}

          {official ? (
            org.groupUrl && (
              <SideSection title="Leadership">
                <p className="font-dm-sans text-xs leading-relaxed text-forum-dark-gray">
                  Officers and membership are managed on{" "}
                  <a
                    href={org.groupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-forum-cerulean underline-offset-2 hover:underline"
                  >
                    MyPrincetonU
                  </a>
                  .
                </p>
              </SideSection>
            )
          ) : (
            <SideSection title="Team">
              {team.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {team.map((member) => (
                    <li key={member.id} className="flex items-center gap-2">
                      <PersonAvatar name={member.displayName} avatarUrl={member.avatarUrl} />
                      <span className="min-w-0 flex-1 truncate font-dm-sans text-sm text-black">
                        {member.displayName}
                      </span>
                      <span className="flex items-center gap-1 font-dm-sans text-[10px] font-medium uppercase tracking-wide text-forum-light-gray">
                        {member.role === "owner" && <Shield size={10} aria-hidden />}
                        {member.role}
                      </span>
                      {org.isOwner && member.role === "officer" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${member.displayName} as officer`}
                          disabled={isPending}
                          onClick={() => handleRemoveOfficer(member.id, member.displayName)}
                        >
                          <X />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-dm-sans text-xs text-forum-light-gray">No officers listed.</p>
              )}
              {org.isOwner && (
                <div className="flex flex-col gap-2 pt-1">
                  <SearchInput
                    label="Add an officer"
                    placeholder="Add an officer…"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <PersonAvatar name={user.displayName} avatarUrl={user.avatarUrl} />
                      <span className="flex-1 truncate font-dm-sans text-sm">
                        {user.displayName}
                      </span>
                      <Button
                        variant="quiet"
                        size="xs"
                        disabled={isPending}
                        onClick={() => handleAddOfficer(user)}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </SideSection>
          )}

          {!official && (
            <p className="font-dm-sans text-xs text-forum-light-gray">
              Created on The Forum.{" "}
              <Link href="/orgs" className="text-forum-cerulean hover:underline">
                Browse official groups
              </Link>
            </p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
