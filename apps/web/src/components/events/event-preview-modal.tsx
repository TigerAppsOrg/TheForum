"use client";

import { Clock, MapPin, X } from "lucide-react";
import { PresetCover } from "~/components/events/cover-presets";
import { EventCoverArt } from "~/components/events/event-cover-art";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "~/components/ui/dialog";

interface EventPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  datetime: string;
  endTime: string;
  location: string;
  tags: string[];
  orgName?: string;
  flyerPreview?: string | null;
  coverPreset?: string | null;
}

/**
 * Read-only preview of an event as attendees will see it. Built on the shadcn
 * Dialog so focus is trapped, Escape closes it, and the page behind is inert.
 */
export function EventPreviewModal({
  open,
  onClose,
  title,
  description,
  datetime,
  endTime,
  location,
  tags,
  orgName,
  flyerPreview,
  coverPreset,
}: EventPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[85dvh] w-full max-w-[600px] gap-0 overflow-y-auto rounded-[16px] border-0 p-0 sm:max-w-[600px]"
      >
        <DialogClose
          aria-label="Close preview"
          className="absolute top-[40px] right-[12px] z-10 rounded-full bg-white/80 p-[6px] shadow-sm transition-colors hover:bg-white"
        >
          <X size={16} aria-hidden className="text-forum-dark-gray" />
        </DialogClose>

        {/* Preview label */}
        <div className="rounded-t-[16px] bg-forum-cerulean py-[6px] text-center text-[10px] font-bold tracking-[0.2em] text-white uppercase">
          Preview — This is how your event will look
        </div>

        {/* Cover */}
        <div className="h-[200px] w-full overflow-hidden">
          {flyerPreview ? (
            <img
              src={flyerPreview}
              alt={`Flyer for ${title || "your event"}`}
              className="h-full w-full object-cover"
            />
          ) : coverPreset ? (
            <PresetCover presetId={coverPreset} className="h-full w-full" />
          ) : (
            <EventCoverArt title={title || "Your Event"} tags={tags} className="h-full w-full" />
          )}
        </div>

        {/* Content */}
        <div className="p-[24px]">
          {tags.length > 0 && (
            <div className="mb-[12px] flex flex-wrap gap-[6px]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[10px] bg-forum-yellow-50 px-[8px] py-[1px] font-dm-sans text-[11px] text-black"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <DialogTitle className="mb-[8px] font-serif text-[28px] leading-tight font-bold text-black">
            {title || "Event Title"}
          </DialogTitle>

          {orgName && (
            <p className="mb-[12px] font-dm-sans text-[13px] text-forum-dark-gray">
              <span className="font-medium">from </span>
              <span className="font-bold">{orgName}</span>
            </p>
          )}

          <div className="mb-[16px] flex flex-col gap-[6px]">
            {location && (
              <div className="flex items-center gap-[6px]">
                <MapPin size={13} aria-hidden className="flex-shrink-0 text-forum-light-gray" />
                <span className="font-dm-sans text-[13px] text-forum-dark-gray">{location}</span>
              </div>
            )}
            {datetime && (
              <div className="flex items-center gap-[6px]">
                <Clock size={13} aria-hidden className="flex-shrink-0 text-forum-light-gray" />
                <span className="font-dm-sans text-[13px] text-forum-dark-gray">
                  {datetime}
                  {endTime ? ` – ${endTime}` : ""}
                </span>
              </div>
            )}
          </div>

          {description && (
            <p className="mb-[20px] font-dm-sans text-[13px] leading-relaxed whitespace-pre-wrap text-forum-dark-gray">
              {description}
            </p>
          )}

          <div className="flex justify-end">
            <span
              aria-hidden
              className="rounded-[8px] bg-forum-coral px-[14px] py-[8px] font-dm-sans text-[12px] font-bold text-white"
            >
              RSVP NOW
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
