"use client";

import { ArrowUp, Eye, Link2, Pencil, Plus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createEvent } from "~/actions/events";
import { CoverPresetsPicker } from "~/components/events/cover-presets";
import {
  type CampusLocation,
  type EventWhen,
  EventWhenFields,
  FORM_ERROR,
  FORM_LABEL,
  LocationPicker,
  OTHER_LOCATION_ID,
  TagPicker,
  type WhenErrors,
  describeEventWhen,
  normalizeExternalLink,
  resolveEventWhen,
} from "~/components/events/event-form-fields";
import { EventPreviewModal } from "~/components/events/event-preview-modal";
import { PageShell, TOP_BAR_CLEARANCE } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import { IMAGE_ACCEPT, uploadImage } from "~/lib/upload-image";
import { cn } from "~/lib/utils";

const TIMELINE_SECTIONS = [
  { id: "cover", label: "Cover & Title", color: "bg-forum-cerulean" },
  { id: "details", label: "Details & Description", color: "bg-forum-coral" },
  { id: "when-where", label: "When & Where", color: "bg-forum-coral" },
  { id: "tags-links", label: "Tags & Links", color: "bg-forum-coral" },
];

interface CreateEventFormProps {
  locations: CampusLocation[];
  userOrgs: { id: string; name: string }[];
}

const PERSONAL_ORG_VALUE = "__personal__";

type FormErrors = WhenErrors &
  Partial<Record<"title" | "description" | "location" | "link", string>>;

export function CreateEventForm({ locations, userOrgs }: CreateEventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState("cover");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState<EventWhen>({ dateKey: "", startTime: "", endTime: "" });
  const [locationId, setLocationId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(PERSONAL_ORG_VALUE);
  const [tags, setTags] = useState<string[]>([]);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [externalLink, setExternalLink] = useState("");
  const [coverPreset, setCoverPreset] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (isUploading) return;
      setIsUploading(true);
      const localPreview = URL.createObjectURL(file);
      setFlyerPreview(localPreview);
      try {
        const publicUrl = await uploadImage(file, "event-flyers");
        setFlyerUrl(publicUrl);
        setFlyerPreview(publicUrl);
      } catch (err) {
        setFlyerPreview(null);
        setFlyerUrl(null);
        toast.error(err instanceof Error ? err.message : "Couldn't upload that image.");
      } finally {
        URL.revokeObjectURL(localPreview);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [isUploading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleImageUpload(file);
    },
    [handleImageUpload],
  );

  const handleSubmit = () => {
    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = "Title is required";
    if (!description.trim()) nextErrors.description = "Description is required";
    if (!locationId) nextErrors.location = "Choose a location, or “Other / off-campus / TBA”";
    const link = normalizeExternalLink(externalLink);
    if (link === null) nextErrors.link = "Enter a valid web address, e.g. https://example.com";
    const resolved = resolveEventWhen(when);
    if (!resolved.ok) Object.assign(nextErrors, resolved.errors);
    else if (resolved.datetime.getTime() < Date.now()) {
      nextErrors.startTime = "This start time has already passed";
    }

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !resolved.ok) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (isUploading) {
      toast.error("Please wait for the cover image to finish uploading.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createEvent({
          title: title.trim(),
          description: description.trim(),
          datetime: resolved.datetime.toISOString(),
          endDatetime: resolved.endDatetime?.toISOString(),
          locationId,
          orgId: selectedOrgId === PERSONAL_ORG_VALUE ? undefined : selectedOrgId,
          tags,
          flyerUrl: flyerUrl ?? undefined,
          coverPreset: flyerUrl ? undefined : (coverPreset ?? undefined),
          externalLink: link || undefined,
          status: "published",
        });
        toast.success("Event published");
        router.push(`/events/${result.id}`);
      } catch {
        toast.error("Couldn't publish your event. Please try again.");
      }
    });
  };

  const previewWhen = describeEventWhen(when);

  return (
    <PageShell width="wide">
      {/* Top buttons */}
      <div
        className={cn("mb-8 flex flex-wrap items-center justify-between gap-3", TOP_BAR_CLEARANCE)}
      >
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye />
            Preview
          </Button>
        </div>
        <Button variant="cerulean" size="cta" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Publishing…" : "Publish"}
        </Button>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-[40px]">
        {/* Timeline sidebar */}
        <nav aria-label="Form sections" className="w-full shrink-0 md:w-[160px]">
          <div className="flex gap-3 overflow-x-auto pb-1 md:sticky md:top-5 md:flex-col md:gap-3 md:overflow-visible">
            {TIMELINE_SECTIONS.map(({ id, label, color }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSection(id);
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex shrink-0 items-center gap-[10px] text-left"
              >
                <div
                  className={cn(
                    "w-[14px] h-[14px] rounded-full transition-colors flex-shrink-0",
                    activeSection === id ? color : "bg-forum-medium-gray",
                  )}
                />
                <span
                  className={cn(
                    "text-[13px] font-dm-sans transition-colors whitespace-nowrap",
                    activeSection === id ? "text-forum-cerulean font-bold" : "text-forum-dark-gray",
                  )}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </nav>

        {/* Form body — single continuous flow */}
        <div className="flex-1 min-w-0">
          {/* ── Cover Image ── */}
          <div id="section-cover" className="mb-[30px]">
            {flyerPreview ? (
              <div className="relative rounded-[10px] overflow-hidden border border-forum-medium-gray mb-[20px]">
                <img
                  src={flyerPreview}
                  alt={`Cover for ${title || "your event"}`}
                  className="w-full h-[220px] sm:h-[280px] object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove cover image"
                  onClick={() => {
                    setFlyerPreview(null);
                    setFlyerUrl(null);
                  }}
                  disabled={isUploading}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={14} aria-hidden />
                </button>
                {isUploading && (
                  <output className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2 text-[13px] font-dm-sans text-forum-dark-gray">
                    <Upload size={18} aria-hidden className="animate-bounce" />
                    Uploading…
                  </output>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="w-full h-[220px] sm:h-[280px] rounded-[10px] bg-forum-turquoise/15 border-2 border-dashed border-forum-turquoise/40 flex flex-col items-end justify-end gap-1 p-[20px] cursor-pointer hover:bg-forum-turquoise/20 transition-colors mb-[20px]"
              >
                <span className="flex items-center gap-[6px] text-[13px] font-bold font-dm-sans text-forum-cerulean">
                  <Pencil size={13} aria-hidden />
                  Add Cover Image
                </span>
                <span className="text-[11px] font-dm-sans text-forum-light-gray">
                  JPEG, PNG or WebP, up to 5 MB
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              aria-label="Upload a cover image"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </div>

          {/* Cover presets — shown when no flyer is uploaded */}
          {!flyerPreview && (
            <div className="mb-[20px]">
              <CoverPresetsPicker selected={coverPreset} onSelect={(id) => setCoverPreset(id)} />
            </div>
          )}

          {/* ── Event Title ── */}
          <div className="mb-[30px]">
            <label htmlFor="event-title" className={FORM_LABEL}>
              Event Title *
            </label>
            <div className="flex items-center border-b-2 border-forum-medium-gray pb-[8px]">
              <input
                id="event-title"
                type="text"
                value={title}
                maxLength={200}
                aria-invalid={errors.title ? true : undefined}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError("title");
                }}
                placeholder="Super Interesting Event Title"
                className={cn(
                  "flex-1 min-w-0 text-[26px] sm:text-[32px] font-serif font-bold text-black placeholder:text-forum-placeholder/40 outline-none",
                  errors.title && "placeholder:text-forum-coral/60",
                )}
              />
              <Pencil size={16} aria-hidden className="text-forum-cerulean flex-shrink-0 ml-2" />
            </div>
            {errors.title && <p className={FORM_ERROR}>{errors.title}</p>}
          </div>

          {/* ── Affiliate Organizations ── */}
          {userOrgs.length > 0 && (
            <div className="mb-[30px]">
              <span className="text-[12px] font-bold text-forum-dark-gray block mb-[8px]">
                Affiliate Organization
              </span>
              <div className="flex items-center gap-[10px] flex-wrap">
                {selectedOrgId !== PERSONAL_ORG_VALUE && (
                  <div className="flex items-center gap-[8px] border border-forum-medium-gray rounded-[6px] px-[10px] py-[6px]">
                    <span
                      aria-hidden
                      className="flex w-[24px] h-[24px] items-center justify-center rounded-[4px] bg-forum-cerulean/20 text-[11px] font-bold text-forum-cerulean"
                    >
                      {userOrgs.find((o) => o.id === selectedOrgId)?.name[0]?.toUpperCase()}
                    </span>
                    <span className="text-[12px] font-bold font-dm-sans text-black">
                      {userOrgs.find((o) => o.id === selectedOrgId)?.name}
                    </span>
                  </div>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-[4px] text-[12px] font-dm-sans text-forum-cerulean hover:underline"
                    >
                      <Plus size={14} aria-hidden />
                      {selectedOrgId === PERSONAL_ORG_VALUE
                        ? "Post as an organization"
                        : "Change organization"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-1" align="start">
                    <button
                      type="button"
                      onClick={() => setSelectedOrgId(PERSONAL_ORG_VALUE)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-forum-turquoise/10"
                    >
                      None (Personal)
                    </button>
                    {userOrgs.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => setSelectedOrgId(org.id)}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-forum-turquoise/10"
                      >
                        {org.name}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* ── Event Description ── */}
          <div id="section-details" className="mb-[30px]">
            <label htmlFor="event-description" className={FORM_LABEL}>
              Event Description *
            </label>
            <Textarea
              id="event-description"
              value={description}
              aria-invalid={errors.description ? true : undefined}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              placeholder="Tell people what to expect..."
              rows={8}
              className={cn(
                "border border-forum-medium-gray rounded-[8px] text-[14px] font-dm-sans placeholder:text-forum-placeholder resize-none focus:border-forum-cerulean",
                errors.description && "border-forum-coral",
              )}
            />
            {errors.description && <p className={FORM_ERROR}>{errors.description}</p>}
          </div>

          {/* ── Date / Start / End ── */}
          <div id="section-when-where" className="mb-[30px]">
            <EventWhenFields
              value={when}
              onChange={(next) => {
                setWhen(next);
                setErrors((prev) => ({
                  ...prev,
                  date: undefined,
                  startTime: undefined,
                  endTime: undefined,
                }));
              }}
              errors={errors}
              disablePastDates
            />
          </div>

          {/* ── Location ── */}
          <div className="mb-[30px]">
            <LocationPicker
              locations={locations}
              value={locationId}
              onChange={(id) => {
                setLocationId(id);
                clearError("location");
              }}
              error={errors.location}
            />
          </div>

          {/* ── Tags ── */}
          <div id="section-tags-links" className="mb-[30px]">
            <TagPicker value={tags} onChange={setTags} />
          </div>

          {/* ── External Link ── */}
          <div className="mb-[30px]">
            <label htmlFor="event-link" className={FORM_LABEL}>
              External Link
            </label>
            <div className="relative">
              <Link2
                size={14}
                aria-hidden
                className="absolute left-[12px] top-1/2 -translate-y-1/2 text-forum-placeholder"
              />
              <input
                id="event-link"
                type="url"
                inputMode="url"
                value={externalLink}
                aria-invalid={errors.link ? true : undefined}
                onChange={(e) => {
                  setExternalLink(e.target.value);
                  clearError("link");
                }}
                placeholder="Registration or info page, e.g. https://…"
                className={cn(
                  "w-full h-[40px] pl-[34px] pr-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans outline-none focus:border-forum-cerulean",
                  errors.link && "border-forum-coral",
                )}
              />
            </div>
            {errors.link && <p className={FORM_ERROR}>{errors.link}</p>}
          </div>

          {/* ── Bottom actions ── */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-t border-forum-medium-gray pt-5">
            <div className="flex items-center gap-4">
              <Button
                variant="quiet"
                size="sm"
                onClick={() =>
                  document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })
                }
              >
                <ArrowUp />
                Back to top
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye />
                Preview
              </Button>
            </div>
            <Button variant="cerulean" size="cta" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <EventPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        description={description}
        datetime={previewWhen.datetime}
        endTime={previewWhen.endTime}
        location={
          locationId === OTHER_LOCATION_ID
            ? "Other / off-campus / TBA"
            : (locations.find((l) => l.id === locationId)?.name ?? "")
        }
        tags={tags}
        orgName={
          selectedOrgId !== PERSONAL_ORG_VALUE
            ? userOrgs.find((o) => o.id === selectedOrgId)?.name
            : undefined
        }
        flyerPreview={flyerPreview}
        coverPreset={coverPreset}
      />
    </PageShell>
  );
}
