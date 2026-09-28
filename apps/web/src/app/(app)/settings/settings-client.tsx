"use client";

import { ArrowLeft, ExternalLink, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FriendProfile } from "~/actions/friends";
import { type UserProfile, updateAvatar, updateProfile } from "~/actions/users";
import { Field } from "~/components/common/field";
import { FilterChip } from "~/components/common/filter-chip";
import { Panel } from "~/components/common/panel";
import { SearchInput } from "~/components/common/search-input";
import {
  PageHeading,
  PageShell,
  SectionHeading,
  TOP_BAR_CLEARANCE,
} from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { PRINCETON_MAJORS } from "~/lib/princeton-departments";
import {
  CAMPUS_REGION_OPTIONS,
  INTEREST_OPTIONS,
  classYearLabel,
  classYearShort,
  getClassYearOptions,
  interestLabel,
  isInterestValue,
  isRegionValue,
  withCurrentOption,
} from "~/lib/profile-options";
import { IMAGE_ACCEPT, uploadImage } from "~/lib/upload-image";
import { cn } from "~/lib/utils";

interface SettingsClientProps {
  profile: UserProfile;
  friends: FriendProfile[];
  /** Organizations the user owns or is an officer of. */
  managedOrgs: { id: string; name: string }[];
}

const MAJOR_OPTIONS = PRINCETON_MAJORS.map((d) => (d.degree ? `${d.name} (${d.degree})` : d.name));

const UNDERLINE_CONTROL =
  "w-full border-b border-forum-medium-gray bg-transparent pb-1.5 font-dm-sans text-[15px] text-black outline-none transition-colors focus:border-forum-cerulean";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

function FriendRow({ friend }: { friend: FriendProfile }) {
  const year = classYearShort(friend.classYear);
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
      {year && <span className="font-dm-sans text-[11px] text-forum-light-gray">{year}</span>}
    </div>
  );
}

export function SettingsClient({ profile, friends, managedOrgs }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /*
   * Saved values, derived from props so they refresh after `router.refresh()`
   * re-renders the server page with what's actually in the database.
   */
  const saved = useMemo(
    () => ({
      displayName: profile.displayName,
      classYear: profile.classYear ?? "",
      major: profile.major ?? "",
      isOrgLeader: profile.isOrgLeader,
      interests: profile.interests.filter(isInterestValue),
      regions: profile.regions.filter(isRegionValue),
    }),
    [profile],
  );

  const [displayName, setDisplayName] = useState(saved.displayName);
  const [classYear, setClassYear] = useState(saved.classYear);
  const [major, setMajor] = useState(saved.major);
  const [isOrgLeader, setIsOrgLeader] = useState(saved.isOrgLeader);
  const [interests, setInterests] = useState<string[]>(saved.interests);
  const [regions, setRegions] = useState<string[]>(saved.regions);
  const [friendSearch, setFriendSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  const classYearOptions = withCurrentOption(getClassYearOptions(), saved.classYear);
  const majorOptions = withCurrentOption(MAJOR_OPTIONS, saved.major);

  const nameError = displayName.trim() ? undefined : "Name can't be empty";

  const hasChanges =
    displayName.trim() !== saved.displayName ||
    classYear !== saved.classYear ||
    major !== saved.major ||
    isOrgLeader !== saved.isOrgLeader ||
    !sameSet(interests, saved.interests) ||
    !sameSet(regions, saved.regions);

  const toggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    );
  };

  const toggleRegion = (value: string) => {
    setRegions((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  };

  const handleSave = () => {
    if (nameError) {
      toast.error(nameError);
      return;
    }
    startTransition(async () => {
      try {
        await updateProfile({
          displayName: displayName.trim(),
          classYear,
          major,
          isOrgLeader,
          interests: interests.filter(isInterestValue),
          regions: regions.filter(isRegionValue),
        });
        toast.success("Settings saved");
        router.refresh();
      } catch {
        toast.error("Couldn't save your settings. Please try again.");
      }
    });
  };

  const handleDiscard = () => {
    setDisplayName(saved.displayName);
    setClassYear(saved.classYear);
    setMajor(saved.major);
    setIsOrgLeader(saved.isOrgLeader);
    setInterests(saved.interests);
    setRegions(saved.regions);
    setTagSearch("");
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (file: File) => {
    const previous = avatarPreview;
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadImage(file, "avatars");
      await updateAvatar(publicUrl);
      setAvatarPreview(publicUrl);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (err) {
      setAvatarPreview(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't update your photo.");
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      !friendSearch ||
      f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
      f.netId.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  const tagQuery = tagSearch.trim().toLowerCase();
  const availableInterests = INTEREST_OPTIONS.filter(
    (o) =>
      !interests.includes(o.value) &&
      (!tagQuery || o.label.toLowerCase().includes(tagQuery) || o.value.includes(tagQuery)),
  );

  return (
    <PageShell width="wide">
      {/* Reserves space so these buttons don't collide with the floating TopBar. */}
      <div className={cn("mb-5 flex items-center justify-between", TOP_BAR_CLEARANCE)}>
        <Button variant="quiet" size="sm" onClick={() => router.back()}>
          <ArrowLeft />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="quiet"
            size="sm"
            onClick={handleDiscard}
            disabled={!hasChanges || isPending}
          >
            Discard
          </Button>
          <Button
            variant="coral"
            size="cta"
            onClick={handleSave}
            disabled={!hasChanges || isPending || Boolean(nameError)}
          >
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
            <div className="relative size-[120px] overflow-hidden rounded-full border-4 border-forum-medium-gray bg-forum-turquoise/20">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={profile.displayName}
                  className="size-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex size-full items-center justify-center font-serif text-[40px] font-bold text-black"
                >
                  {profile.displayName[0]?.toUpperCase()}
                </div>
              )}
              {isUploadingAvatar && (
                <output className="absolute inset-0 flex items-center justify-center bg-white/70 font-dm-sans text-[11px] font-bold text-forum-dark-gray">
                  Uploading…
                </output>
              )}
            </div>
            <Button
              variant="outline"
              size="xs"
              className="border-forum-cerulean text-forum-cerulean hover:bg-forum-cerulean/5"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
            >
              <Pencil />
              Edit Photo
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              aria-label="Upload a profile photo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
              }}
            />
          </div>

          <div className="grid min-w-[260px] flex-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            <Field id="display-name" label="Name" required error={nameError}>
              <input
                id="display-name"
                type="text"
                value={displayName}
                maxLength={255}
                autoComplete="name"
                onChange={(e) => setDisplayName(e.target.value)}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "display-name-error" : undefined}
                className={UNDERLINE_CONTROL}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <span className="font-dm-sans text-sm font-semibold text-black">NetID</span>
              <p className="pb-1.5 font-dm-sans text-[15px] text-forum-dark-gray">
                {profile.netId}
                <span className="ml-2 text-[11px] text-forum-light-gray">
                  from your Princeton login
                </span>
              </p>
            </div>

            <Field id="class-year" label="Class Year">
              <select
                id="class-year"
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                className={cn(UNDERLINE_CONTROL, "appearance-none")}
              >
                <option value="">Select</option>
                {classYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {classYearLabel(y)}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="major" label="Major / Department">
              <select
                id="major"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className={cn(UNDERLINE_CONTROL, "appearance-none")}
              >
                <option value="">Undeclared / prefer not to say</option>
                {majorOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isOrgLeader}
                  onChange={(e) => setIsOrgLeader(e.target.checked)}
                  className="mt-0.5 size-4 accent-forum-cerulean"
                />
                <span className="font-dm-sans text-[13px] text-black">
                  <span className="font-semibold">I lead or manage a student organization</span>
                  <span className="block text-[12px] text-forum-light-gray">
                    Lets you create an organization page and publish events for it.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Panel>
      </section>

      {/* ═══ Friends + Organizations ═══ */}
      <div className="mb-8 flex flex-wrap gap-8">
        <section className="min-w-[280px] flex-1">
          <SectionHeading>Friends</SectionHeading>
          <Panel className="flex flex-col gap-3">
            {friends.length > 0 ? (
              <>
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
                  {filteredFriends.length === 0 && (
                    <li className="font-dm-sans text-[12px] italic text-forum-light-gray">
                      No friends match &ldquo;{friendSearch}&rdquo;.
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <p className="font-dm-sans text-[12px] italic text-forum-light-gray">
                You haven&apos;t added any friends yet.
              </p>
            )}

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
            {managedOrgs.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {managedOrgs.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/orgs/${org.id}`}
                      className="flex items-center gap-2.5 rounded-md py-1 font-dm-sans text-[13px] font-bold text-black hover:text-forum-cerulean"
                    >
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-forum-cerulean/20 text-[13px] text-forum-cerulean"
                      >
                        {org.name[0]?.toUpperCase()}
                      </span>
                      <span className="truncate">{org.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-dm-sans text-[12px] italic text-forum-light-gray">
                You don&apos;t manage any organizations yet.
              </p>
            )}

            <Button asChild variant="outline" size="xs" className="w-fit">
              <Link href="/orgs">
                Browse organizations
                <ExternalLink />
              </Link>
            </Button>
          </Panel>
        </section>
      </div>

      {/* ═══ Interests ═══ */}
      <section className="mb-8">
        <SectionHeading>Interest Tags</SectionHeading>
        <Panel className="flex flex-col gap-6">
          <p className="font-dm-sans text-[12px] text-forum-light-gray">
            Your Explore feed is ranked around these.
          </p>
          <div className="flex flex-wrap gap-8">
            <fieldset className="min-w-[280px] flex-1">
              <legend className="mb-2.5 font-dm-sans text-[12px] font-bold text-forum-dark-gray">
                Your topics
              </legend>
              <div className="flex flex-wrap gap-2">
                {interests.map((value) => {
                  const label = interestLabel(value);
                  return (
                    <FilterChip
                      key={value}
                      active
                      aria-label={`Remove ${label}`}
                      onClick={() => toggleInterest(value)}
                    >
                      {label}
                      <X aria-hidden />
                    </FilterChip>
                  );
                })}
                {interests.length === 0 && (
                  <p className="font-dm-sans text-[12px] italic text-forum-light-gray">
                    No topics selected yet — add some from the list.
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className="min-w-[280px] flex-1">
              <legend className="mb-2.5 font-dm-sans text-[12px] font-bold text-forum-dark-gray">
                Add topics
              </legend>
              <SearchInput
                label="Filter topics"
                placeholder="Filter topics"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="mb-3 h-10"
              />
              <div className="flex flex-wrap gap-2">
                {availableInterests.map((option) => (
                  <FilterChip
                    key={option.value}
                    aria-label={`Add ${option.label}`}
                    onClick={() => toggleInterest(option.value)}
                  >
                    {option.label}
                  </FilterChip>
                ))}
                {availableInterests.length === 0 && (
                  <p className="font-dm-sans text-[12px] italic text-forum-light-gray">
                    {tagQuery ? "No matching topics." : "You've added every topic."}
                  </p>
                )}
              </div>
            </fieldset>
          </div>
        </Panel>
      </section>

      {/* ═══ Campus Regions ═══ */}
      <section className="mb-8">
        <SectionHeading>Campus Regions</SectionHeading>
        <Panel>
          <fieldset>
            <legend className="mb-3 font-dm-sans text-[12px] text-forum-light-gray">
              Where you usually are on campus. We use this to surface nearby events.
            </legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPUS_REGION_OPTIONS.map(({ value, label, desc }) => {
                const selected = regions.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleRegion(value)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
                      selected
                        ? "border-forum-cerulean bg-forum-turquoise/10"
                        : "border-forum-medium-gray hover:border-forum-dark-gray",
                    )}
                  >
                    <span>
                      <span className="block font-dm-sans text-[14px] font-bold text-forum-dark-gray">
                        {label}
                      </span>
                      <span className="block font-dm-sans text-[11px] text-forum-light-gray">
                        {desc}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "size-[13px] shrink-0 rounded-full border-2 transition-colors",
                        selected
                          ? "border-forum-cerulean bg-forum-cerulean"
                          : "border-forum-medium-gray",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Panel>
      </section>

      {/* ═══ About ═══ */}
      <section className="mb-10">
        <SectionHeading>About</SectionHeading>
        <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 font-dm-sans text-[13px]">
          <Link href="/privacy" className="text-forum-cerulean hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="text-forum-cerulean hover:underline">
            Terms of Use
          </Link>
          <a href="mailto:it.admin@tigerapps.org" className="text-forum-cerulean hover:underline">
            Contact: it.admin@tigerapps.org
          </a>
        </Panel>
      </section>
    </PageShell>
  );
}
