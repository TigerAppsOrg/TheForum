"use client";

import { ArrowLeft, ExternalLink, Pencil, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
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
  { id: "free-food", label: "Free Food" },
  { id: "career-recruiting", label: "Career & Recruiting" },
  { id: "research", label: "Research" },
  { id: "stem", label: "STEM" },
  { id: "academics", label: "Academics" },
  { id: "tech", label: "Tech" },
  { id: "entrepreneurship", label: "Entrepreneurship" },
  { id: "politics-policy", label: "Politics & Policy" },
  { id: "visual-arts", label: "Visual Arts" },
  { id: "performing-arts", label: "Performing Arts" },
  { id: "literature", label: "Literature" },
  { id: "culture", label: "Culture" },
  { id: "music", label: "Music" },
  { id: "gaming", label: "Gaming" },
  { id: "athletics", label: "Athletics" },
  { id: "religion", label: "Religion" },
  { id: "sustainability", label: "Sustainability" },
  { id: "outdoor-adventure", label: "Outdoor & Adventure" },
  { id: "wellness-self-care", label: "Wellness & Self-Care" },
  { id: "community-service", label: "Community Service" },
  { id: "speaker-event", label: "Speaker Event" },
  { id: "social-event", label: "Social Event" },
] as const;

const LEGACY_INTEREST_ALIASES: Record<string, string> = {
  career: "career-recruiting",
  careerrecruiting: "career-recruiting",
  academic: "research",
  academics: "academics",
  tech: "tech",
  political: "politics-policy",
  politics: "politics-policy",
  art: "visual-arts",
  visual: "visual-arts",
  performance: "performing-arts",
  performing: "performing-arts",
  cultural: "culture",
  culture: "culture",
  sports: "athletics",
  athletic: "athletics",
  religious: "religion",
  religion: "religion",
  outdoor: "outdoor-adventure",
  outdoors: "outdoor-adventure",
  wellness: "wellness-self-care",
  speaker: "speaker-event",
  social: "social-event",
  "free-food": "free-food",
  "free food": "free-food",
  "community-service": "community-service",
  "community service": "community-service",
  "politics-policy": "politics-policy",
  "politics policy": "politics-policy",
  "visual-arts": "visual-arts",
  "visual arts": "visual-arts",
  "performing-arts": "performing-arts",
  "performing arts": "performing-arts",
  "wellness-self-care": "wellness-self-care",
  "wellness self care": "wellness-self-care",
  "speaker-event": "speaker-event",
  "speaker event": "speaker-event",
  "social-event": "social-event",
  "social event": "social-event",
  stem: "stem",
};

function normalizeInterestValue(tag: string): string {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, "-");
  return LEGACY_INTEREST_ALIASES[normalized] ?? normalized;
}

function dedupeInterestValues(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeInterestValue(value)).filter(Boolean))];
}

const CLASS_YEARS = ["2025", "2026", "2027", "2028", "2029", "Grad"];

interface SettingsClientProps {
  profile: UserProfile;
  friends: FriendProfile[];
}

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
  const initialClassYear = profile.classYear ?? "";
  const initialMajor = profile.major ?? "";
  const initialInterests = dedupeInterestValues(profile.interests);
  const initialAvatar = profile.avatarUrl;

  const [classYear, setClassYear] = useState(initialClassYear);
  const [major, setMajor] = useState(initialMajor);
  const [isOrgLeader, setIsOrgLeader] = useState(profile.isOrgLeader);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [friendSearch, setFriendSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  const toggleInterest = (id: string) => {
    setInterests((prev) => {
      const next = prev.includes(id) ? prev.filter((interest) => interest !== id) : [...prev, id];
      return dedupeInterestValues(next);
    });
  };

  const interestsChanged =
    interests.length !== initialInterests.length ||
    interests.some((interest) => !initialInterests.includes(interest));

  const hasChanges =
    classYear !== initialClassYear ||
    major !== initialMajor ||
    isOrgLeader !== profile.isOrgLeader ||
    interestsChanged;

  const handleSave = () => {
    startTransition(async () => {
      try {
        const sanitizedInterests = dedupeInterestValues(interests);
        await updateProfile({
          classYear,
          major,
          isOrgLeader,
          interests: sanitizedInterests,
          regions: profile.regions,
        });
        setInterests(sanitizedInterests);
        toast.success("Settings saved");
      } catch {
        toast.error("Could not save settings. Please try again.");
      }
    });
  };

  const handleCancel = () => {
    setClassYear(initialClassYear);
    setMajor(initialMajor);
    setIsOrgLeader(profile.isOrgLeader);
    setInterests(initialInterests);
    setAvatarPreview(initialAvatar);
    setTagSearch("");
    toast.message("Changes discarded");
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatar);

  const handleAvatarUpload = async (file: File) => {
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
      toast.success("Profile photo updated");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarPreview(profile.avatarUrl);
      toast.error("Could not upload avatar. Please try another image.");
    }
  };

  const filteredTags = INTEREST_TAGS.filter(
    (tag) =>
      !tagSearch ||
      tag.label.toLowerCase().includes(tagSearch.toLowerCase()) ||
      tag.id.toLowerCase().includes(tagSearch.toLowerCase()),
  );

  const filteredFriends = friends.filter(
    (f) =>
      !friendSearch ||
      f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
      f.netId.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  return (
    <PageShell width="wide">
      <div className="mb-5 flex items-center justify-between pr-[100px]">
        <Button variant="quiet" size="sm" onClick={() => router.back()}>
          <ArrowLeft />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="quiet"
            size="sm"
            onClick={handleCancel}
            disabled={!hasChanges || isPending}
          >
            Cancel
          </Button>
          <Button
            variant="coral"
            size="cta"
            onClick={handleSave}
            disabled={isPending || !hasChanges}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <PageHeading>My Account</PageHeading>

      <section className="mb-8">
        <SectionHeading>Personal Info</SectionHeading>
        <Panel className="flex flex-wrap items-start gap-8">
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

            <Field id="major" label="Major" className="min-w-[200px] flex-1">
              <input
                id="major"
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Computer Science"
                className="w-full border-b border-forum-medium-gray bg-transparent pb-1.5 font-dm-sans text-[15px] text-black outline-none"
              />
            </Field>
          </div>
        </Panel>
      </section>

      <div className="mb-8 flex flex-wrap gap-8">
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

      <section className="mb-8">
        <SectionHeading>Interest Tags</SectionHeading>
        <Panel className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-8">
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

            <fieldset className="min-w-[280px] flex-1">
              <legend className="mb-2.5 flex items-center gap-2 font-dm-sans text-[12px] font-bold text-forum-dark-gray">
                <Search size={12} aria-hidden className="text-forum-placeholder" />
                Suggested tags
              </legend>
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => (
                  <FilterChip
                    key={tag.id}
                    active={interests.includes(tag.id)}
                    onClick={() => toggleInterest(tag.id)}
                    aria-label={tag.label}
                  >
                    {tag.label}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
          </div>

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
    </PageShell>
  );
}
