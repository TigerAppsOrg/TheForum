"use client";

import { ArrowLeft, ExternalLink, Pencil, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { FriendProfile } from "~/actions/friends";
import { getPresignedUploadUrl } from "~/actions/upload";
import { type UserProfile, updateAvatar, updateProfile } from "~/actions/users";
import { Field } from "~/components/common/field";
import { FilterChip } from "~/components/common/filter-chip";
import { Panel } from "~/components/common/panel";
import { SearchInput } from "~/components/common/search-input";
import { PageHeading, PageShell, SectionHeading } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";

const INTEREST_TAGS = [
  { id: "free food", label: "free food" },
  { id: "tech", label: "technology" },
  { id: "stem", label: "science and engineering" },
  { id: "visual arts", label: "visual arts" },
  { id: "wellness", label: "fitness & health" },
  { id: "academics", label: "academics" },
  { id: "research", label: "research" },
  { id: "career", label: "career" },
  { id: "entrepreneurship", label: "entrepreneurship" },
  { id: "music", label: "music" },
  { id: "social event", label: "social" },
  { id: "athletics", label: "sports" },
  { id: "performing arts", label: "performing arts" },
  { id: "culture", label: "culture" },
  { id: "literature", label: "literature" },
  { id: "community service", label: "service" },
  { id: "religion", label: "religion" },
  { id: "politics", label: "politics" },
  { id: "gaming", label: "gaming" },
  { id: "outdoors", label: "outdoors" },
  { id: "sustainability", label: "sustainability" },
  { id: "speaker event", label: "speaker" },
];

const SUGGESTION_TAGS = [
  "tech talk",
  "Jane Street",
  "consulting",
  "internship",
  "Citadel",
  "Lockheed Martin",
  "free merch",
  "Bain & Company",
];

const CLASS_YEARS = ["2025", "2026", "2027", "2028", "2029", "Grad"];

interface SettingsClientProps {
  profile: UserProfile;
  friends: FriendProfile[];
}

/** Single friend row — was duplicated verbatim in both Friends sections. */
function FriendRow({ friend }: { friend: FriendProfile }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-9 shrink-0 overflow-hidden rounded-full bg-forum-turquoise/20">
        {friend.avatarUrl ? (
          <img src={friend.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <div
            aria-hidden
            className="flex size-full items-center justify-center text-[13px] font-bold text-black"
          >
            {friend.displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-dm-sans text-[13px] font-bold text-black">
          {friend.displayName}
        </span>
        <span className="font-dm-sans text-[10px] text-forum-light-gray">@{friend.netId}</span>
      </div>
      {friend.classYear && (
        <span className="font-dm-sans text-[11px] text-forum-light-gray">
          &apos;{friend.classYear.slice(-2)}
        </span>
      )}
    </div>
  );
}

export function SettingsClient({ profile, friends }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [classYear, setClassYear] = useState(profile.classYear ?? "");
  const [major, setMajor] = useState(profile.major ?? "");
  const [isOrgLeader, setIsOrgLeader] = useState(profile.isOrgLeader);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [friendSearch, setFriendSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateProfile({
        classYear,
        major,
        isOrgLeader,
        interests,
        regions: [],
      });
      router.push("/explore");
    });
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);

  const handleAvatarUpload = async (file: File) => {
    // Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        folder: "avatars",
      });
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await updateAvatar(publicUrl);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarPreview(profile.avatarUrl);
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      !friendSearch ||
      f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
      f.netId.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  return (
    <PageShell width="wide">
      {/* Top bar — pr reserves space so buttons don't overlap the TopBar notification/avatar */}
      <div className="mb-5 flex items-center justify-between pr-[100px]">
        <Button variant="quiet" size="sm" onClick={() => router.back()}>
          <ArrowLeft />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="quiet" size="sm" onClick={() => router.push("/explore")}>
            Exit
          </Button>
          <Button variant="coral" size="cta" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <PageHeading>My Account</PageHeading>

      {/* ═══ Personal Info ═══ */}
      <section className="mb-8">
        <SectionHeading>Personal Info</SectionHeading>
        <Panel className="flex flex-wrap items-start gap-8">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="size-[120px] overflow-hidden rounded-full border-4 border-forum-medium-gray bg-forum-turquoise/20">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="size-full object-cover" />
              ) : (
                <div
                  aria-hidden
                  className="flex size-full items-center justify-center font-serif text-[40px] font-bold text-black"
                >
                  {profile.displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="xs"
              className="border-forum-cerulean text-forum-cerulean hover:bg-forum-cerulean/5"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Pencil />
              Edit Photo
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
              }}
            />
          </div>

          {/* Name + Class Year inline */}
          <div className="flex min-w-[280px] flex-1 flex-wrap gap-5">
            <Field id="display-name" label="Name" required className="min-w-[180px] flex-1">
              <div className="flex items-center gap-2 border-b border-forum-medium-gray pb-1.5">
                <span id="display-name" className="font-dm-sans text-[15px] text-black">
                  {profile.displayName}
                </span>
                <Pencil size={11} aria-hidden className="text-forum-light-gray" />
              </div>
            </Field>
            <Field id="class-year" label="Class Year" required className="w-[140px]">
              <select
                id="class-year"
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                className="w-full appearance-none border-b border-forum-medium-gray bg-transparent pb-1.5 font-dm-sans text-[15px] text-black outline-none focus:border-forum-cerulean"
              >
                <option value="">Select</option>
                {CLASS_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>
      </section>

      {/* ═══ Friends + Organizations — two columns ═══ */}
      <div className="mb-8 flex flex-wrap gap-8">
        {/* Friends column */}
        <section className="min-w-[280px] flex-1">
          <SectionHeading>Friends</SectionHeading>
          <Panel className="flex flex-col gap-3">
            <SearchInput
              label="Search friends"
              placeholder="Search"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
            />

            <ul className="flex max-h-[260px] flex-col gap-2 overflow-y-auto">
              {filteredFriends.map((friend) => (
                <li key={friend.id}>
                  <FriendRow friend={friend} />
                </li>
              ))}
            </ul>

            <Button asChild variant="outline" size="xs" className="w-fit">
              <Link href="/friends">
                Add / edit my friends list
                <ExternalLink />
              </Link>
            </Button>
          </Panel>
        </section>

        {/* Organizations column */}
        <section className="min-w-[280px] flex-1">
          <SectionHeading>Organizations</SectionHeading>
          <Panel className="flex flex-col gap-3">
            <SearchInput
              label="Search organizations"
              placeholder="Search"
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
            />

            <p className="font-dm-sans text-[12px] italic text-forum-light-gray">
              No organizations yet. Follow orgs from the Orgs page.
            </p>

            <Button asChild variant="outline" size="xs" className="w-fit">
              <Link href="/orgs">
                Add / edit my organizations
                <ExternalLink />
              </Link>
            </Button>
          </Panel>
        </section>
      </div>

      {/* ═══ Interest Tags ═══ */}
      <section className="mb-8">
        <SectionHeading>Interest Tags</SectionHeading>
        <Panel className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-8">
            {/* Selected topics */}
            <fieldset className="min-w-[280px] flex-1">
              <legend className="mb-2.5 font-dm-sans text-[12px] font-bold text-forum-dark-gray">
                Topics
              </legend>
              <div className="flex flex-wrap gap-2">
                {interests.map((tagId) => {
                  const tag = INTEREST_TAGS.find((t) => t.id === tagId);
                  const label = tag?.label ?? tagId;
                  return (
                    <FilterChip
                      key={tagId}
                      active
                      aria-label={`Remove ${label}`}
                      onClick={() => toggleInterest(tagId)}
                    >
                      {label}
                      <X aria-hidden />
                    </FilterChip>
                  );
                })}
                {interests.length === 0 && (
                  <p className="font-dm-sans text-[12px] italic text-forum-light-gray">
                    No topics selected yet.
                  </p>
                )}
              </div>
            </fieldset>

            {/* Search for new tags */}
            <fieldset className="min-w-[280px] flex-1">
              <legend className="mb-2.5 flex items-center gap-2 font-dm-sans text-[12px] font-bold text-forum-dark-gray">
                <Search size={12} aria-hidden className="text-forum-placeholder" />
                Suggested tags
              </legend>
              <div className="flex flex-wrap gap-2">
                {SUGGESTION_TAGS.map((tag) => (
                  <FilterChip key={tag} active={interests.includes(tag)} disabled>
                    {tag}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Organizations — link to orgs page */}
          <div>
            <span className="mb-2 block font-dm-sans text-[12px] font-bold text-forum-dark-gray">
              Organizations
            </span>
            <p className="font-dm-sans text-[12px] text-forum-light-gray">
              Manage your organization memberships from the{" "}
              <Link href="/orgs" className="text-forum-cerulean hover:underline">
                Orgs page
              </Link>
              .
            </p>
          </div>
        </Panel>
      </section>

      {/* ═══ Friends + Organizations (bottom expanded view) ═══ */}
      <div className="flex gap-[30px] mb-[40px]">
        {/* Friends expanded */}
        <div className="flex-1">
          <div className="flex items-center gap-[8px] mb-[12px]">
            <div className="w-[12px] h-[12px] rounded-full bg-forum-coral" />
            <h2 className="font-serif text-[20px] text-forum-coral font-bold">Friends</h2>
          </div>

          {/* Avatar large */}
          <div className="w-[120px] h-[120px] rounded-full border-[4px] border-forum-medium-gray overflow-hidden bg-forum-turquoise/20 mx-auto mb-[16px]">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[40px] font-bold text-black font-serif">
                {profile.displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <div className="relative mb-[12px]">
            <Search
              size={14}
              className="absolute left-[10px] top-1/2 -translate-y-1/2 text-forum-placeholder"
            />
            <input
              type="text"
              placeholder="Search"
              className="w-full h-[32px] pl-[30px] pr-[10px] border border-forum-medium-gray rounded-[6px] text-[12px] font-dm-sans outline-none focus:border-forum-cerulean"
            />
          </div>

          <div className="space-y-[8px]">
            {friends.map((friend) => (
              <div key={`bottom-${friend.id}`} className="flex items-center gap-[10px]">
                <div className="w-[36px] h-[36px] rounded-full overflow-hidden bg-forum-turquoise/20 flex-shrink-0">
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      alt={friend.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[13px] font-bold text-black">
                      {friend.displayName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-bold font-dm-sans text-black truncate block">
                    {friend.displayName}
                  </span>
                  <span className="text-[10px] font-dm-sans text-forum-light-gray">
                    @{friend.netId}
                  </span>
                </div>
                {friend.classYear && (
                  <span className="text-[11px] font-dm-sans text-forum-light-gray">
                    &apos;{friend.classYear.slice(-2)}
                  </span>
                )}
              </div>
            ))}
          </div>

          <Link
            href="/friends"
            className="flex items-center gap-[6px] mt-[12px] px-[12px] py-[6px] border border-forum-medium-gray rounded-[6px] text-[10px] font-bold font-dm-sans text-forum-dark-gray tracking-wider hover:border-forum-dark-gray transition-colors w-fit"
          >
            ADD / EDIT MY FRIENDS LIST
            <ExternalLink size={10} />
          </Link>
        </div>

        {/* Organizations expanded */}
        <div className="flex-1">
          <div className="flex items-center gap-[8px] mb-[12px]">
            <div className="w-[12px] h-[12px] rounded-full bg-forum-coral" />
            <h2 className="font-serif text-[20px] text-forum-coral font-bold">Organizations</h2>
          </div>

          <div className="relative mb-[12px]">
            <Search
              size={14}
              className="absolute left-[10px] top-1/2 -translate-y-1/2 text-forum-placeholder"
            />
            <input
              type="text"
              placeholder="Search"
              className="w-full h-[32px] pl-[30px] pr-[10px] border border-forum-medium-gray rounded-[6px] text-[12px] font-dm-sans outline-none focus:border-forum-cerulean"
            />
          </div>

          <div className="space-y-[8px]">
            {[1, 2, 3, 4].map((i) => (
              <div key={`org-${i}`} className="flex items-center gap-[10px]">
                <div className="w-[36px] h-[36px] rounded-[5px] bg-forum-cerulean/20 flex-shrink-0 flex items-center justify-center">
                  <div className="w-[20px] h-[20px] bg-forum-cerulean rounded-[3px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-bold font-dm-sans text-black block">
                    Princeton TigerApps
                  </span>
                  <span className="text-[10px] font-dm-sans text-forum-light-gray">
                    Design Lead
                  </span>
                </div>
                <button
                  type="button"
                  className="text-[10px] font-bold font-dm-sans text-forum-light-gray hover:text-forum-dark-gray transition-colors"
                >
                  Edit Role
                </button>
              </div>
            ))}
          </div>

          <Link
            href="/orgs"
            className="flex items-center gap-[6px] mt-[12px] px-[12px] py-[6px] border border-forum-medium-gray rounded-[6px] text-[10px] font-bold font-dm-sans text-forum-dark-gray tracking-wider hover:border-forum-dark-gray transition-colors w-fit"
          >
            ADD / EDIT MY ORGANIZATIONS
            <ExternalLink size={10} />
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
