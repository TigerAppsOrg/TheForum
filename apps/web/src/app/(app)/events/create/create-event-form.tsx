"use client";

import { format } from "date-fns";
import {
  ArrowUp,
  CalendarIcon,
  ChevronDown,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Link2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { createEvent } from "~/actions/events";
import { getPresignedUploadUrl } from "~/actions/upload";
import { FilterChip } from "~/components/common/filter-chip";
import { CoverPresetsPicker } from "~/components/events/cover-presets";
import { EventPreviewModal } from "~/components/events/event-preview-modal";
import { PageShell } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

const TIMELINE_SECTIONS = [
  { id: "cover", label: "Cover & Title", color: "bg-forum-cerulean" },
  { id: "details", label: "Details & Description", color: "bg-forum-coral" },
  { id: "when-where", label: "When & Where", color: "bg-forum-coral" },
  { id: "uploads", label: "Uploads & Links", color: "bg-forum-coral" },
];

interface CreateEventFormProps {
  locations: { id: string; name: string; category: string }[];
  userOrgs: { id: string; name: string }[];
}

const PERSONAL_ORG_VALUE = "__personal__";

export function CreateEventForm({ locations, userOrgs }: CreateEventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState("cover");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("06:00 PM");
  const [endTime, setEndTime] = useState("08:00 PM");
  const [locationId, setLocationId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(PERSONAL_ORG_VALUE);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [externalLink, setExternalLink] = useState("");
  const [coverPreset, setCoverPreset] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; preview: string; type: string }[]
  >([]);

  const filteredLocations = locations.filter(
    (loc) => !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
  );
  const selectedLocationName = locations.find((l) => l.id === locationId)?.name ?? "";

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagSearch("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (isUploading) return;
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = (e) => setFlyerPreview(e.target?.result as string);
        reader.readAsDataURL(file);

        const { uploadUrl, publicUrl } = await getPresignedUploadUrl({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: "event-flyers",
        });

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        setFlyerUrl(publicUrl);
      } catch (err) {
        console.error("Upload failed:", err);
        setFlyerPreview(null);
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleImageUpload(file);
    },
    [handleImageUpload],
  );

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          preview: e.target?.result as string,
          type: file.type.startsWith("image/") ? "image" : "doc",
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    if (!locationId) newErrors.location = "Location is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Must match eventTagEnum in apps/database/src/schema (client component, so
  // the list is inlined rather than importing the server-only schema package)
  const VALID_TAGS = [
    "free food",
    "career",
    "research",
    "academics",
    "tech",
    "entrepreneurship",
    "politics",
    "visual arts",
    "performing arts",
    "literature",
    "culture",
    "music",
    "gaming",
    "athletics",
    "religion",
    "sustainability",
    "outdoors",
    "wellness",
    "community service",
    "speaker event",
    "social event",
    "stem",
  ];

  const doCreate = (status: "published" | "draft") => {
    if (status === "published" && !validate()) return;
    // For drafts, only require title
    if (status === "draft" && !title.trim()) {
      setErrors({ title: "Title is required even for drafts" });
      return;
    }
    startTransition(async () => {
      const datetime = date ? new Date(date) : new Date();
      datetime.setHours(18, 0);

      const result = await createEvent({
        title: title.trim(),
        description: description.trim() || "Draft — no description yet",
        datetime: datetime.toISOString(),
        locationId: locationId || "frist",
        orgId: selectedOrgId === PERSONAL_ORG_VALUE ? undefined : selectedOrgId,
        tags: tags.filter((t) => VALID_TAGS.includes(t)),
        flyerUrl: flyerUrl ?? undefined,
        coverPreset: coverPreset ?? undefined,
        externalLink: externalLink.trim() || undefined,
        isPublic,
        status,
      });

      router.push(status === "draft" ? "/events" : `/events/${result.id}`);
    });
  };

  const handleSubmit = () => doCreate("published");
  const handleSaveDraft = () => doCreate("draft");

  return (
    <PageShell width="wide">
      {/* Top buttons */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isPending}>
            {isPending ? "Saving…" : "Save as draft"}
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
        <div className="w-full shrink-0 md:w-[160px]">
          <div className="flex gap-3 overflow-x-auto pb-1 md:sticky md:top-5 md:flex-col md:gap-3 md:overflow-visible">
            {TIMELINE_SECTIONS.map(({ id, label, color }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSection(id);
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-[10px] text-left"
              >
                <div
                  className={cn(
                    "w-[14px] h-[14px] rounded-full transition-colors flex-shrink-0",
                    activeSection === id ? color : "bg-forum-medium-gray",
                  )}
                />
                <span
                  className={cn(
                    "text-[13px] font-dm-sans transition-colors",
                    activeSection === id ? "text-forum-cerulean font-bold" : "text-forum-dark-gray",
                  )}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form body — single continuous flow */}
        <div className="flex-1 min-w-0">
          {/* ── Cover Image ── */}
          <div id="section-cover" className="mb-[30px]">
            {flyerPreview ? (
              <div className="relative rounded-[10px] overflow-hidden border border-forum-medium-gray mb-[20px]">
                <img
                  src={flyerPreview}
                  alt="Cover preview"
                  className="w-full h-[280px] object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFlyerPreview(null);
                    setFlyerUrl(null);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={14} />
                </button>
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Upload size={18} className="animate-bounce text-forum-dark-gray" />
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="w-full h-[280px] rounded-[10px] bg-forum-turquoise/15 border-2 border-dashed border-forum-turquoise/40 flex items-end justify-end p-[20px] cursor-pointer hover:bg-forum-turquoise/20 transition-colors mb-[20px]"
              >
                <span className="flex items-center gap-[6px] text-[13px] font-bold font-dm-sans text-forum-cerulean">
                  <Pencil size={13} />
                  Add Cover Image
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
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
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
              Event Title *
            </span>
            <div className="flex items-center border-b-2 border-forum-medium-gray pb-[8px]">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="Super Interesting Event Title"
                className={cn(
                  "flex-1 text-[32px] font-serif font-bold text-black placeholder:text-forum-placeholder/40 outline-none",
                  errors.title && "placeholder:text-forum-coral/60",
                )}
              />
              <Pencil size={16} className="text-forum-cerulean flex-shrink-0 ml-2" />
            </div>
            {errors.title && <p className="text-[11px] text-forum-coral mt-1">{errors.title}</p>}
          </div>

          {/* ── Affiliate Organizations ── */}
          {userOrgs.length > 0 && (
            <div className="mb-[30px]">
              <span className="text-[12px] font-bold text-forum-dark-gray block mb-[8px]">
                Affiliate Organizations
              </span>
              <div className="flex items-center gap-[10px] flex-wrap">
                {selectedOrgId !== PERSONAL_ORG_VALUE && (
                  <div className="flex items-center gap-[8px] border border-forum-medium-gray rounded-[6px] px-[10px] py-[6px]">
                    <div className="w-[24px] h-[24px] rounded-[4px] bg-forum-cerulean/20 flex items-center justify-center">
                      <div className="w-[14px] h-[14px] bg-forum-cerulean rounded-[2px]" />
                    </div>
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
                      <Plus size={14} />
                      Affiliate Organization
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
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
              Event Description *
            </span>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: "" }));
              }}
              placeholder="Tell people what to expect..."
              rows={8}
              className={cn(
                "border border-forum-medium-gray rounded-[8px] text-[14px] font-dm-sans placeholder:text-forum-placeholder resize-none focus:border-forum-cerulean",
                errors.description && "border-forum-coral",
              )}
            />
            {errors.description && (
              <p className="text-[11px] text-forum-coral mt-1">{errors.description}</p>
            )}
          </div>

          {/* ── Date / Start / End ── */}
          <div id="section-when-where" className="mb-[30px]">
            <div className="flex items-end gap-[20px]">
              <div>
                <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
                  Date *
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-2 h-[40px] px-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans",
                        date ? "text-black" : "text-forum-placeholder",
                        errors.date && "border-forum-coral",
                      )}
                    >
                      <CalendarIcon size={14} />
                      {date ? format(date, "MM/dd/yyyy") : "mm/dd/yyyy"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        setDate(d);
                        if (errors.date) setErrors((prev) => ({ ...prev, date: "" }));
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date && <p className="text-[11px] text-forum-coral mt-1">{errors.date}</p>}
              </div>
              <div>
                <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
                  Start *
                </span>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-[40px] w-[110px] px-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans text-black outline-none focus:border-forum-cerulean"
                />
              </div>
              <span className="text-[14px] text-forum-light-gray mb-[10px]">—</span>
              <div>
                <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">End *</span>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-[40px] w-[110px] px-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans text-forum-placeholder outline-none focus:border-forum-cerulean"
                />
              </div>
            </div>
          </div>

          {/* ── Location ── */}
          <div className="mb-[30px]">
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
              Location *
            </span>
            <div className="flex gap-[20px]">
              <div className="flex-1">
                <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-[12px] top-1/2 -translate-y-1/2 text-forum-placeholder"
                      />
                      <input
                        type="text"
                        value={locationSearch || selectedLocationName}
                        onChange={(e) => {
                          setLocationSearch(e.target.value);
                          setLocationOpen(true);
                        }}
                        onFocus={() => setLocationOpen(true)}
                        placeholder="Search by keyword or address"
                        className={cn(
                          "w-full h-[40px] pl-[34px] pr-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans outline-none focus:border-forum-cerulean",
                          errors.location && "border-forum-coral",
                        )}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <div className="max-h-52 overflow-y-auto p-1">
                      {filteredLocations.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            setLocationId(loc.id);
                            setLocationSearch("");
                            setLocationOpen(false);
                            if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                            locationId === loc.id
                              ? "bg-forum-turquoise/20 text-black"
                              : "text-forum-dark-gray hover:bg-forum-turquoise/10",
                          )}
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {errors.location && (
                  <p className="text-[11px] text-forum-coral mt-1">{errors.location}</p>
                )}
              </div>
              {/* Map placeholder */}
              <div className="w-[280px] h-[200px] rounded-[10px] bg-forum-turquoise/10 flex items-center justify-center text-[12px] text-forum-light-gray flex-shrink-0">
                Select Location on map
              </div>
            </div>
          </div>

          {/* ── Upload Files ── */}
          <div id="section-uploads" className="mb-[30px]">
            <div className="flex items-center gap-[6px] mb-[10px]">
              <Plus size={14} className="text-forum-cerulean" />
              <span className="text-[13px] font-dm-sans text-forum-cerulean font-bold">
                Upload Files
              </span>
            </div>
            <div className="flex gap-[12px] flex-wrap">
              {uploadedFiles.map((file, i) => (
                <div
                  key={file.name ?? `file-${i}`}
                  className="relative w-[160px] h-[120px] rounded-[8px] border border-forum-medium-gray overflow-hidden"
                >
                  {file.type === "image" ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-forum-medium-gray">
                      <FileText size={24} className="text-forum-light-gray" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 p-1 rounded-full bg-forum-cerulean text-white"
                  >
                    <Trash2 size={10} />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-white/90 px-[8px] py-[4px]">
                    <p className="text-[9px] font-dm-sans text-forum-dark-gray truncate">
                      {file.name}
                    </p>
                  </div>
                </div>
              ))}
              <label className="w-[160px] h-[120px] rounded-[8px] border-2 border-dashed border-forum-medium-gray flex items-center justify-center cursor-pointer hover:border-forum-cerulean transition-colors">
                <Plus size={20} className="text-forum-light-gray" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* ── Add Tags ── */}
          <div className="mb-[30px]">
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
              Add Tags *
            </span>
            <div className="flex items-center gap-[10px] mb-[10px]">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-[12px] top-1/2 -translate-y-1/2 text-forum-placeholder"
                />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagSearch.trim()) {
                      addTag(tagSearch.trim().toLowerCase());
                    }
                  }}
                  placeholder="Free food, tech talk, volunteering"
                  className="w-full h-[40px] pl-[34px] pr-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans outline-none focus:border-forum-cerulean"
                />
              </div>
              <Button
                variant="outline"
                className="border-forum-cerulean text-forum-cerulean hover:bg-forum-cerulean/5"
              >
                Keyword
              </Button>
              <Button
                variant="outline"
                className="border-forum-cerulean text-forum-cerulean hover:bg-forum-cerulean/5"
              >
                Organization
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <FilterChip
                  key={tag}
                  active
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                  <X aria-hidden />
                </FilterChip>
              ))}
            </div>
          </div>

          {/* ── External Links ── */}
          <div className="mb-[30px]">
            <Button variant="quiet" size="sm" className="mb-2.5 text-forum-cerulean">
              <Plus />
              Add External Links
            </Button>
            {externalLink ? (
              <div className="flex items-center gap-[8px]">
                <Link2 size={14} className="text-forum-cerulean" />
                <a
                  href={externalLink}
                  className="text-[13px] font-dm-sans text-forum-cerulean underline"
                >
                  {externalLink}
                </a>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove external link"
                  onClick={() => setExternalLink("")}
                >
                  <X className="text-forum-light-gray" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Link2
                  size={14}
                  className="absolute left-[12px] top-1/2 -translate-y-1/2 text-forum-placeholder"
                />
                <input
                  type="text"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  placeholder="www.registerforsomething.com"
                  className="w-full h-[40px] pl-[34px] pr-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans outline-none focus:border-forum-cerulean"
                />
              </div>
            )}
          </div>

          {/* ── Bottom actions ── */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-t border-forum-medium-gray pt-5">
            <div className="flex items-center gap-4">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <ArrowUp />
                Back to top
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye />
                Preview
              </Button>
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isPending}>
                {isPending ? "Saving…" : "Save as draft"}
              </Button>
              <Button variant="cerulean" size="cta" onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <EventPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        description={description}
        datetime={date ? format(date, "EEE, MMM d, yyyy") : ""}
        endTime={endTime}
        location={locations.find((l) => l.id === locationId)?.name ?? ""}
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
