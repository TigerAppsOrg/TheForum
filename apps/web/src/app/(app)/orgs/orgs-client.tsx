"use client";

import { Heart, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";
import { type OrgListItem, getOrgs, toggleFollowOrg } from "~/actions/orgs";
import { FilterChip, FilterChipGroup } from "~/components/common/filter-chip";
import { Panel } from "~/components/common/panel";
import { SearchInput } from "~/components/common/search-input";
import { EmptyState } from "~/components/common/states";
import { SectionHeading } from "~/components/layout/page-shell";
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
    setOrgs((prev) =>
      prev.map((o) =>
        o.id === orgId
          ? {
              ...o,
              isFollowing: !o.isFollowing,
              followerCount: o.isFollowing ? o.followerCount - 1 : o.followerCount + 1,
            }
          : o,
      ),
    );
    startTransition(async () => {
      await toggleFollowOrg(orgId);
    });
  };

  return (
    <div className="space-y-6">
      {/* Search + Create */}
      <div className="flex items-center gap-3">
        <SearchInput
          label="Search organizations"
          placeholder="Search organizations…"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
        />
        <Button asChild variant="cerulean">
          <Link href="/orgs/create">
            <Plus />
            Create
          </Link>
        </Button>
      </div>

      {/* Category filters */}
      <FilterChipGroup label="Filter organizations by category">
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

      {/* Recommended for You */}
      {recommendedOrgs.length > 0 && (
        <section>
          <SectionHeading>Recommended for You</SectionHeading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {recommendedOrgs.map((org) => {
              const color = orgColor(org.name);
              return (
                <Panel
                  asChild
                  key={org.id}
                  size="sm"
                  className="flex items-center gap-3 transition-colors hover:border-forum-cerulean"
                >
                  <Link href={`/orgs/${org.id}`}>
                    <div
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: color?.bg }}
                    >
                      {org.logoUrl ? (
                        <img
                          src={org.logoUrl}
                          alt=""
                          className="size-full rounded-lg object-cover"
                        />
                      ) : (
                        <span className="text-sm font-black" style={{ color: color?.text }}>
                          {org.name[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-dm-sans text-sm font-semibold text-black">
                        {org.name}
                      </p>
                      <p className="font-dm-sans text-xs capitalize text-forum-light-gray">
                        {org.category}
                      </p>
                    </div>
                  </Link>
                </Panel>
              );
            })}
          </div>
        </section>
      )}

      {/* Orgs grid */}
      {orgs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {orgs.map((org) => {
            const color = orgColor(org.name);
            return (
              <Panel
                key={org.id}
                size="none"
                className="overflow-hidden transition-colors hover:border-forum-cerulean"
              >
                <Link href={`/orgs/${org.id}`} className="block">
                  <div
                    aria-hidden
                    className="flex h-20 items-center justify-center"
                    style={{ background: color?.bg }}
                  >
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt="" className="size-12 rounded-lg object-cover" />
                    ) : (
                      <span className="text-2xl font-black" style={{ color: color?.text }}>
                        {org.name[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/orgs/${org.id}`}>
                    <h3 className="font-dm-sans text-sm font-bold text-black transition-colors hover:text-forum-cerulean">
                      {org.name}
                    </h3>
                  </Link>
                  <p className="mt-0.5 font-dm-sans text-xs capitalize text-forum-light-gray">
                    {org.category}
                  </p>
                  {org.description && (
                    <p className="mt-2 font-dm-sans text-xs text-forum-dark-gray line-clamp-2">
                      {org.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-forum-medium-gray pt-3">
                    <span className="flex items-center gap-1 font-dm-sans text-xs text-forum-light-gray">
                      <Users size={11} aria-hidden />
                      {org.followerCount} follower{org.followerCount !== 1 ? "s" : ""}
                    </span>
                    <Button
                      variant={org.isFollowing ? "soft" : "ghost"}
                      size="xs"
                      aria-pressed={org.isFollowing}
                      disabled={isPending}
                      onClick={() => handleToggleFollow(org.id)}
                      className={cn(
                        "rounded-full",
                        org.isFollowing ? "text-forum-cerulean" : "text-forum-light-gray",
                      )}
                    >
                      <Heart fill={org.isFollowing ? "currentColor" : "none"} />
                      {org.isFollowing ? "Following" : "Follow"}
                    </Button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
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
