"use client";

import { Check, Eye, EyeOff, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type HiddenOrg,
  type OrgListItem,
  getOrgs,
  toggleFollowOrg,
  unblockOrg,
} from "~/actions/orgs";
import { FilterChip, FilterChipGroup } from "~/components/common/filter-chip";
import { OrgAvatar } from "~/components/common/org-avatar";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState } from "~/components/common/states";
import { Button } from "~/components/ui/button";
import { formatTimeAgo } from "~/lib/date-format";
import { cn } from "~/lib/utils";

const ORG_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "career", label: "Career" },
  { id: "affinity", label: "Affinity" },
  { id: "performing arts", label: "Performing Arts" },
  { id: "academics", label: "Academics" },
  { id: "athletics", label: "Athletics" },
  { id: "social event", label: "Social" },
  { id: "culture", label: "Culture" },
  { id: "religion", label: "Religion" },
  { id: "politics", label: "Politics" },
  { id: "community service", label: "Service" },
];

/** Pseudo-category: the orgs the viewer hid from their feed. */
const HIDDEN = "hidden";

interface OrgsClientProps {
  initialOrgs: OrgListItem[];
  recommendedOrgs: OrgListItem[];
  /** Orgs the viewer hid, most recent first. */
  initialHidden: HiddenOrg[];
  /** Open on the Hidden filter (`/orgs?view=hidden`). */
  showHidden?: boolean;
}

export function OrgsClient({
  initialOrgs,
  recommendedOrgs,
  initialHidden,
  showHidden = false,
}: OrgsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [orgs, setOrgs] = useState(initialOrgs);
  const [hidden, setHidden] = useState(initialHidden);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    showHidden && initialHidden.length > 0 ? HIDDEN : "all",
  );
  const viewingHidden = activeCategory === HIDDEN;
  const hiddenChipRef = useRef<HTMLButtonElement>(null);

  /*
   * Arriving on /orgs?view=hidden: scroll the chip row (not the page — which
   * scrollIntoView would also move) to its end, where the Hidden chip sits.
   */
  useEffect(() => {
    const row = hiddenChipRef.current?.parentElement;
    if (showHidden && row) row.scrollLeft = row.scrollWidth;
  }, [showHidden]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const refreshOrgs = useCallback((search?: string, category?: string) => {
    startTransition(async () => {
      const result = await getOrgs({
        search: search || undefined,
        category: category === "all" ? undefined : category,
      });
      setOrgs(result);
    });
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    // Searching always searches every org — leave the Hidden list for it.
    const category = viewingHidden ? "all" : activeCategory;
    if (viewingHidden) setActiveCategory("all");
    searchTimeout.current = setTimeout(() => {
      refreshOrgs(query, category);
    }, 300);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (cat !== HIDDEN) refreshOrgs(searchQuery, cat);
  };

  const handleUnhide = (org: HiddenOrg) => {
    setHidden((prev) => prev.filter((o) => o.id !== org.id));
    setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, isHidden: false } : o)));
    startTransition(async () => {
      try {
        await unblockOrg(org.id);
        toast(`Events from ${org.name} will show in your feed again`);
      } catch {
        setHidden((prev) => [org, ...prev]);
        setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, isHidden: true } : o)));
        toast.error("Couldn't unhide that organization. Please try again.");
      }
    });
  };

  const handleToggleFollow = (orgId: string) => {
    const flip = (o: OrgListItem) =>
      o.id === orgId
        ? {
            ...o,
            isFollowing: !o.isFollowing,
            followerCount: o.isFollowing ? o.followerCount - 1 : o.followerCount + 1,
          }
        : o;
    const before = orgs.find((o) => o.id === orgId);
    const hiddenBefore = hidden;
    setOrgs((prev) => prev.map(flip));
    // Following unhides.
    if (before && !before.isFollowing && before.isHidden) {
      setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, isHidden: false } : o)));
      setHidden((prev) => prev.filter((o) => o.id !== orgId));
    }
    startTransition(async () => {
      try {
        await toggleFollowOrg(orgId);
      } catch {
        setOrgs((prev) => prev.map((o) => (o.id === orgId && before ? { ...before } : o)));
        setHidden(hiddenBefore);
        toast.error("Couldn't update that follow. Please try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchInput
          label="Search organizations"
          shortcut
          placeholder="Search organizations…"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
        />
        <Button asChild variant="cerulean" size="sm" className="h-11 rounded-full px-4">
          <Link href="/orgs/create">
            <Plus />
            <span className="hidden sm:inline">New organization</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </div>

      <FilterChipGroup label="Filter organizations by category" className="gap-1.5">
        {ORG_CATEGORIES.map(({ id, label }) => (
          <FilterChip
            key={id}
            active={activeCategory === id}
            onClick={() => handleCategoryChange(id)}
          >
            {label}
          </FilterChip>
        ))}
        {/* Only once something is hidden — or while viewing the list, so unhiding the last one doesn't yank it away. */}
        {(hidden.length > 0 || viewingHidden) && (
          <FilterChip
            ref={hiddenChipRef}
            active={viewingHidden}
            onClick={() => handleCategoryChange(HIDDEN)}
          >
            <EyeOff aria-hidden />
            Hidden
            <span className="text-forum-light-gray">{hidden.length}</span>
          </FilterChip>
        )}
      </FilterChipGroup>

      {viewingHidden ? (
        <HiddenOrgList orgs={hidden} onUnhide={handleUnhide} />
      ) : (
        <>
          {recommendedOrgs.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-dm-sans text-[12px] text-forum-light-gray">
              <span className="font-semibold uppercase tracking-[0.08em] text-[11px]">
                Suggested
              </span>
              {recommendedOrgs.map((org, i) => (
                <span key={org.id}>
                  <Link
                    href={`/orgs/${org.id}`}
                    className="font-medium text-forum-cerulean hover:underline"
                  >
                    {org.name}
                  </Link>
                  {i < recommendedOrgs.length - 1 && <span aria-hidden> · </span>}
                </span>
              ))}
            </p>
          )}

          {orgs.length > 0 ? (
            <ul
              className={cn(
                "divide-y divide-forum-border overflow-hidden rounded-[20px] border border-forum-border bg-white",
                isPending && "opacity-70 transition-opacity",
              )}
            >
              {orgs.map((org) => {
                return (
                  <li
                    key={org.id}
                    className="relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-forum-turquoise/10 sm:px-5"
                  >
                    <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} />
                    <div className="min-w-0 flex-1 font-dm-sans">
                      <Link
                        href={`/orgs/${org.id}`}
                        className="block truncate text-[14px] font-semibold text-black after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
                      >
                        {org.name}
                      </Link>
                      <p className="truncate text-[12px] text-forum-light-gray">
                        {org.isHidden && (
                          <span className="font-medium text-forum-dark-gray">Hidden · </span>
                        )}
                        <span className="capitalize">{org.category}</span> · {org.followerCount}{" "}
                        {org.followerCount === 1 ? "follower" : "followers"}
                        {org.description && (
                          <span className="hidden sm:inline"> · {org.description}</span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant={org.isFollowing ? "soft" : "outline"}
                      size="xs"
                      aria-pressed={org.isFollowing}
                      aria-label={`${org.isFollowing ? "Unfollow" : "Follow"} ${org.name}`}
                      onClick={() => handleToggleFollow(org.id)}
                      className={cn(
                        "relative z-10 h-7 shrink-0 rounded-full px-3 text-[12px]",
                        org.isFollowing && "text-forum-cerulean",
                      )}
                    >
                      {org.isFollowing && <Check />}
                      {org.isFollowing ? "Following" : "Follow"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title="No organizations found"
              description={
                searchQuery || activeCategory !== "all"
                  ? "Try adjusting your search or filters."
                  : "Be the first to create one!"
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/** The Hidden filter: orgs whose events you removed from your feed, with Unhide. */
function HiddenOrgList({
  orgs,
  onUnhide,
}: {
  orgs: HiddenOrg[];
  onUnhide: (org: HiddenOrg) => void;
}) {
  if (orgs.length === 0) {
    return (
      <EmptyState
        icon={EyeOff}
        title="No hidden organizations"
        description="Hide an organization from an event's ⋯ menu or its page, and it shows up here."
      />
    );
  }
  return (
    <>
      <p className="font-dm-sans text-[12px] text-forum-light-gray">
        Their events are left out of Home, the map and suggestions. Their pages and event links
        still work.
      </p>
      <ul className="divide-y divide-forum-border overflow-hidden rounded-[20px] border border-forum-border bg-white">
        {orgs.map((org) => (
          <li
            key={org.id}
            className="relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-forum-turquoise/10 sm:px-5"
          >
            <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} />
            <div className="min-w-0 flex-1 font-dm-sans">
              <Link
                href={`/orgs/${org.id}`}
                className="block truncate text-[14px] font-semibold text-black after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
              >
                {org.name}
              </Link>
              <p className="truncate text-[12px] text-forum-light-gray">
                <span className="capitalize">{org.category}</span> · hidden{" "}
                {formatTimeAgo(new Date(org.hiddenAt))}
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              aria-label={`Unhide ${org.name}`}
              onClick={() => onUnhide(org)}
              className="relative z-10 h-7 shrink-0 rounded-full px-3 text-[12px]"
            >
              <Eye />
              Unhide
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
