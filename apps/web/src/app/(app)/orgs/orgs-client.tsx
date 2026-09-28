"use client";

import { Check, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { type OrgListItem, getOrgs, toggleFollowOrg } from "~/actions/orgs";
import { FilterChip, FilterChipGroup } from "~/components/common/filter-chip";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState } from "~/components/common/states";
import { Button } from "~/components/ui/button";
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

function orgColor(name: string) {
  const colors = [
    { bg: "#eef2ff", text: "#4338ca" },
    { bg: "#fef3c7", text: "#92400e" },
    { bg: "#ecfdf5", text: "#065f46" },
    { bg: "#fce7f3", text: "#9d174d" },
    { bg: "#eff6ff", text: "#1e40af" },
    { bg: "#fef9c3", text: "#854d0e" },
    { bg: "#f0fdf4", text: "#166534" },
    { bg: "#faf5ff", text: "#6b21a8" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length] ?? colors[0];
}

interface OrgsClientProps {
  initialOrgs: OrgListItem[];
  recommendedOrgs: OrgListItem[];
}

export function OrgsClient({ initialOrgs, recommendedOrgs }: OrgsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [orgs, setOrgs] = useState(initialOrgs);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
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
    searchTimeout.current = setTimeout(() => {
      refreshOrgs(query, activeCategory);
    }, 300);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    refreshOrgs(searchQuery, cat);
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
    setOrgs((prev) => prev.map(flip));
    startTransition(async () => {
      try {
        await toggleFollowOrg(orgId);
      } catch {
        setOrgs((prev) => prev.map(flip));
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
        <Button asChild variant="cerulean" size="sm" className="h-10">
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
      </FilterChipGroup>

      {recommendedOrgs.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-dm-sans text-[12px] text-forum-light-gray">
          <span className="font-semibold uppercase tracking-[0.08em] text-[11px]">Suggested</span>
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
            "divide-y divide-forum-border overflow-hidden rounded-lg border border-forum-border bg-white",
            isPending && "opacity-70 transition-opacity",
          )}
        >
          {orgs.map((org) => {
            const color = orgColor(org.name);
            return (
              <li
                key={org.id}
                className="relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-forum-turquoise/10 sm:px-4"
              >
                <div
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md"
                  style={{ background: color?.bg }}
                >
                  {org.logoUrl ? (
                    <img src={org.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-[13px] font-bold" style={{ color: color?.text }}>
                      {org.name[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 font-dm-sans">
                  <Link
                    href={`/orgs/${org.id}`}
                    className="block truncate text-[14px] font-semibold text-black after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
                  >
                    {org.name}
                  </Link>
                  <p className="truncate text-[12px] text-forum-light-gray">
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
    </div>
  );
}
