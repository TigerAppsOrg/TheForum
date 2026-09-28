"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { type UserProfile, updateAvatar, updateProfile } from "~/actions/users";
import { Field } from "~/components/common/field";
import { FilterChip } from "~/components/common/filter-chip";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PRINCETON_MAJORS } from "~/lib/princeton-departments";
import {
  CAMPUS_REGION_OPTIONS,
  INTEREST_OPTIONS,
  classYearLabel,
  getClassYearOptions,
  isInterestValue,
  isRegionValue,
  withCurrentOption,
} from "~/lib/profile-options";
import { CONTACT_EMAIL } from "~/lib/site";
import { IMAGE_ACCEPT, uploadImage } from "~/lib/upload-image";
import { cn } from "~/lib/utils";

const MAJOR_OPTIONS = PRINCETON_MAJORS.map((d) => (d.degree ? `${d.name} (${d.degree})` : d.name));

/** Native select styled to match the shadcn Input — keyboard-friendly, no popover. */
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Compact chip sizing for dense multi-selects. */
const CHIP_CLASS = "h-7 px-3 text-[12px]";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Settings is one short form: who you are and what you want to see. Friends
 * and organizations are managed on their own pages and only linked from here.
 */
export function SettingsClient({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Saved values come from props, so they refresh after `router.refresh()`.
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError || !hasChanges) return;
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

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (file: File) => {
    const previous = avatarUrl;
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);
    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadImage(file, "avatars");
      await updateAvatar(publicUrl);
      setAvatarUrl(publicUrl);
      toast.success("Photo updated");
      router.refresh();
    } catch (err) {
      setAvatarUrl(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't update your photo.");
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  return (
    <PageShell width="narrow">
      <PageHeading>Settings</PageHeading>

      <form onSubmit={handleSave} className="flex flex-col gap-5 font-dm-sans">
        {/* Identity */}
        <div className="flex items-center gap-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-full bg-forum-turquoise/40">
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile.displayName} className="size-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="flex size-full items-center justify-center text-[15px] font-bold text-black"
              >
                {profile.displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-forum-dark-gray">
              <span className="font-semibold text-black">@{profile.netId}</span> · {profile.email}
            </p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="text-[12px] font-medium text-forum-cerulean hover:underline disabled:opacity-50"
            >
              {isUploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
            </button>
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
        </div>

        <Field id="display-name" label="Name" error={nameError}>
          <Input
            id="display-name"
            value={displayName}
            maxLength={255}
            autoComplete="name"
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "display-name-error" : undefined}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="class-year" label="Class year">
            <select
              id="class-year"
              value={classYear}
              onChange={(e) => setClassYear(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Select</option>
              {classYearOptions.map((y) => (
                <option key={y} value={y}>
                  {classYearLabel(y)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="major" label="Major">
            <select
              id="major"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Undeclared / prefer not to say</option>
              {majorOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-black">Campus areas</legend>
          <p className="mb-2 text-xs text-forum-light-gray">
            Where you usually are — nearby events rank higher.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CAMPUS_REGION_OPTIONS.map(({ value, label, desc }) => (
              <FilterChip
                key={value}
                active={regions.includes(value)}
                title={desc}
                className={CHIP_CLASS}
                onClick={() => setRegions((prev) => toggle(prev, value))}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-black">Interests</legend>
          <p className="mb-2 text-xs text-forum-light-gray">
            Your Explore feed is ranked around these.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map(({ value, label }) => (
              <FilterChip
                key={value}
                active={interests.includes(value)}
                className={CHIP_CLASS}
                onClick={() => setInterests((prev) => toggle(prev, value))}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={isOrgLeader}
            onChange={(e) => setIsOrgLeader(e.target.checked)}
            className="mt-0.5 size-4 accent-forum-cerulean"
          />
          <span className="text-[13px] text-black">
            I lead or manage a student organization
            <span className="block text-xs text-forum-light-gray">
              Lets you create an organization page and post events for it.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3 border-t border-forum-border pt-4">
          <Button
            type="submit"
            variant="cerulean"
            disabled={!hasChanges || isPending || Boolean(nameError)}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
          {hasChanges && !isPending && (
            <span className="text-xs text-forum-light-gray">You have unsaved changes</span>
          )}
        </div>
      </form>

      <nav
        aria-label="More settings"
        className="mt-8 divide-y divide-forum-border rounded-lg border border-forum-border font-dm-sans text-[13px]"
      >
        {[
          { href: "/friends", label: "Friends", hint: "Add, accept, or remove friends" },
          { href: "/orgs", label: "Organizations", hint: "Follow or manage organizations" },
        ].map(({ href, label, hint }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-forum-turquoise/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forum-cerulean",
            )}
          >
            <span>
              <span className="font-semibold text-black">{label}</span>
              <span className="ml-2 text-forum-light-gray">{hint}</span>
            </span>
            <ChevronRight size={14} aria-hidden className="text-forum-light-gray" />
          </Link>
        ))}
      </nav>

      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-dm-sans text-xs text-forum-light-gray">
        <Link href="/privacy" className="hover:text-black hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-black hover:underline">
          Terms of Use
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-black hover:underline">
          {CONTACT_EMAIL}
        </a>
      </p>
    </PageShell>
  );
}
