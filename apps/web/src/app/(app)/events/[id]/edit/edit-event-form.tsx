"use client";

import { format } from "date-fns";
import {
  ArrowUp,
  CalendarIcon,
  ExternalLink,
  Eye,
  Globe,
  ImagePlus,
  Link2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { type EventDetail, updateEvent } from "~/actions/events";
import { getPresignedUploadUrl } from "~/actions/upload";
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

interface EditEventFormProps {
  event: EventDetail;
  locations: { id: string; name: string; category: string }[];
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function EditEventForm({ event, locations }: EditEventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState("cover");

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [date, setDate] = useState<Date | undefined>(event.datetime);
  const [startTime, setStartTime] = useState(
    `${pad(event.datetime.getHours())}:${pad(event.datetime.getMinutes())}`,
  );
  const [endTime, setEndTime] = useState(
    event.endDatetime
      ? `${pad(event.endDatetime.getHours())}:${pad(event.endDatetime.getMinutes())}`
      : "",
  );
  const [locationId, setLocationId] = useState(event.locationId);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(event.tags);
  const [tagSearch, setTagSearch] = useState("");
  const [flyerUrl, setFlyerUrl] = useState<string | null>(event.flyerUrl);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(event.flyerUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [externalLink, setExternalLink] = useState(event.externalLink ?? "");
  const [isPublic, setIsPublic] = useState(event.isPublic);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredLocations = locations.filter(
    (loc) => !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
  );
  const selectedLocationName = locations.find((l) => l.id === locationId)?.name ?? "";

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagSearch("");
  };
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

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
        setFlyerPreview(event.flyerUrl);
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading, event.flyerUrl],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleImageUpload(file);
    },
    [handleImageUpload],
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    if (!locationId) newErrors.location = "Location is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    startTransition(async () => {
      const datetime = new Date(date as Date);
      const [h, m] = startTime.split(":").map(Number);
      datetime.setHours(h ?? 0, m ?? 0);

      let endDatetime: string | undefined;
      if (endTime) {
        const end = new Date(date as Date);
        const [eh, em] = endTime.split(":").map(Number);
        end.setHours(eh ?? 0, em ?? 0);
        endDatetime = end.toISOString();
      }

      await updateEvent(event.id, {
        title: title.trim(),
        description: description.trim(),
        datetime: datetime.toISOString(),
        endDatetime,
        locationId,
        tags,
        flyerUrl: flyerUrl ?? undefined,
        externalLink: externalLink.trim() || undefined,
        isPublic,
      });
      router.push(`/events/${event.id}`);
    });
  };

  return (
    <PageShell width="wide">
      {/* Top buttons */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 pr-[100px]">
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="outline" size="sm">
            <Eye />
            Preview
          </Button>
        </div>
        <Button variant="cerulean" size="cta" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
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
                  document.getElementById(`edit-${id}`)?.scrollIntoView({ behavior: "smooth" });
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

        {/* Form body */}
        <div className="flex-1 min-w-0">
          {/* Cover Image */}
          <div id="edit-cover" className="mb-[30px]">
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
                  <Pencil size={13} /> Add Cover Image
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

          {/* Event Title */}
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

          {/* Event Description */}
          <div id="edit-details" className="mb-[30px]">
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

          {/* Date / Start / End */}
          <div id="edit-when-where" className="mb-[30px]">
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
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-[40px] w-[120px] px-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans text-black outline-none focus:border-forum-cerulean"
                />
              </div>
              <span className="text-[14px] text-forum-light-gray mb-[10px]">—</span>
              <div>
                <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">End</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-[40px] w-[120px] px-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans text-forum-placeholder outline-none focus:border-forum-cerulean"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="mb-[30px]">
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
              Location *
            </span>
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
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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

          {/* Visibility */}
          <div className="flex items-center justify-between mb-[30px]">
            <div className="flex items-center gap-[10px]">
              {isPublic ? (
                <Globe size={16} className="text-forum-cerulean" />
              ) : (
                <Lock size={16} className="text-forum-orange" />
              )}
              <div>
                <p className="text-[13px] font-bold font-dm-sans text-black">
                  {isPublic ? "Public Event" : "Private Event"}
                </p>
                <p className="text-[11px] font-dm-sans text-forum-light-gray">
                  {isPublic ? "Anyone on campus can discover this" : "Only people with the link"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                isPublic ? "bg-forum-cerulean" : "bg-forum-medium-gray",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                  isPublic ? "translate-x-5.5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          {/* Tags */}
          <div className="mb-[30px]">
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">Tags</span>
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
                    if (e.key === "Enter" && tagSearch.trim())
                      addTag(tagSearch.trim().toLowerCase());
                  }}
                  placeholder="Free food, tech talk, volunteering"
                  className="w-full h-[40px] pl-[34px] pr-[14px] border border-forum-medium-gray rounded-[8px] text-[13px] font-dm-sans outline-none focus:border-forum-cerulean"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="flex items-center gap-[4px] h-[28px] px-[12px] rounded-[14px] bg-forum-cerulean text-white text-[11px] font-bold font-dm-sans"
                >
                  {tag} <X size={11} />
                </button>
              ))}
            </div>
          </div>

          {/* External Link */}
          <div id="edit-uploads" className="mb-[30px]">
            <span className="text-[13px] font-bold text-forum-coral block mb-[6px]">
              External Link
            </span>
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
          </div>

          {/* Bottom actions */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-t border-forum-medium-gray pt-5">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <ArrowUp /> Back to top
            </Button>
            <Button variant="cerulean" size="cta" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
