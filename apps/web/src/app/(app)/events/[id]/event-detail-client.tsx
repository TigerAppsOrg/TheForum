"use client";

import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  ChevronLeft,
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type EventDetail,
  type FeedEvent,
  deleteEvent,
  toggleRsvp,
  toggleSave,
} from "~/actions/events";
import { Panel } from "~/components/common/panel";
import { getCategoryColor } from "~/components/events/event-card";
import { EventCoverArt } from "~/components/events/event-cover-art";
import { PageHeading, PageShell, SectionHeading } from "~/components/layout/page-shell";
import { AvatarStack } from "~/components/social/avatar-stack";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

function buildGCalUrl(event: {
  title: string;
  description: string;
  datetime: Date;
  endDatetime: Date | null;
  locationName: string;
}) {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const start = fmt(event.datetime);
  const end = fmt(event.endDatetime ?? new Date(event.datetime.getTime() + 60 * 60 * 1000));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description,
    location: event.locationName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface EventDetailClientProps {
  event: EventDetail;
  similarEvents: FeedEvent[];
}

export function EventDetailClient({ event, similarEvents }: EventDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRsvped, setIsRsvped] = useState(event.isRsvped);
  const [isSaved, setIsSaved] = useState(event.isSaved);
  const [rsvpCount, setRsvpCount] = useState(event.rsvpCount);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const color = getCategoryColor(event.tags);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const handleRsvp = () => {
    const prev = isRsvped;
    setIsRsvped(!prev);
    setRsvpCount((c) => (prev ? c - 1 : c + 1));
    startTransition(async () => {
      const result = await toggleRsvp(event.id);
      setIsRsvped(result.rsvped);
      setRsvpCount(result.count);
    });
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    startTransition(async () => {
      const result = await toggleSave(event.id);
      setIsSaved(result.saved);
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${event.id}`;
    if (navigator.share) {
      await navigator.share({ title: event.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteEvent(event.id);
      router.push("/explore");
    });
  };

  return (
    <PageShell>
      {/* Back link */}
      <Button variant="quiet" size="sm" onClick={() => router.back()} className="mb-6">
        <ChevronLeft />
        Back
      </Button>

      {/* Main content */}
      <div className="flex flex-wrap gap-10">
        {/* Left: Flyer */}
        <div className="w-[340px] shrink-0">
          <div className="h-[440px] overflow-hidden rounded-xl shadow-lg">
            {event.flyerUrl ? (
              <img src={event.flyerUrl} alt="" className="size-full object-cover" />
            ) : (
              <EventCoverArt title={event.title} tags={event.tags} className="size-full" />
            )}
          </div>
        </div>

        {/* Right: Event info */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Action buttons */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {event.isOwner && (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/events/${event.id}/edit`}>
                      <Edit3 /> Edit
                    </Link>
                  </Button>
                  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-forum-coral/30 text-forum-coral hover:bg-forum-coral/5"
                      >
                        <Trash2 /> Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Event</DialogTitle>
                        <DialogDescription>
                          This will permanently delete &ldquo;{event.title}&rdquo;. This cannot be
                          undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                          Cancel
                        </Button>
                        <Button variant="coral" onClick={handleDelete} disabled={isPending}>
                          {isPending ? "Deleting…" : "Delete Event"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={buildGCalUrl(event)} target="_blank" rel="noopener noreferrer">
                  <Calendar /> Calendar
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 /> Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={isSaved}
                onClick={handleSave}
                className={cn(
                  isSaved && "border-forum-cerulean bg-forum-turquoise/10 text-forum-cerulean",
                )}
              >
                {isSaved ? <BookmarkCheck /> : <Bookmark />}
                {isSaved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          {/* Title */}
          <PageHeading className="text-[28px] font-bold leading-tight sm:text-[32px] lg:text-[36px]">
            {event.title}
          </PageHeading>

          {/* Org */}
          {event.orgName && (
            <p className="text-[16px] font-dm-sans font-bold text-forum-cerulean mb-[12px]">
              {event.orgName}
            </p>
          )}

          {/* Tags */}
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-[8px] mb-[20px]">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-[10px] py-[2px] rounded-[15px] text-[14px] font-dm-sans text-black bg-forum-yellow-50"
                >
                  {tag}
                </span>
              ))}
              <span
                className={cn(
                  "px-[10px] py-[2px] rounded-[15px] text-[12px] font-bold font-dm-sans",
                  event.isPublic
                    ? "bg-forum-turquoise/20 text-forum-cerulean"
                    : "bg-forum-orange/10 text-forum-orange",
                )}
              >
                {event.isPublic ? "Public" : "Private"}
              </span>
            </div>
          )}

          {/* Details */}
          <div className="space-y-[10px] mb-[20px]">
            <div className="flex items-center gap-[10px] text-[14px] font-dm-sans text-forum-dark-gray">
              <Calendar size={16} className="text-forum-light-gray" />
              {formatDate(event.datetime)}
            </div>
            <div className="flex items-center gap-[10px] text-[14px] font-dm-sans text-forum-dark-gray">
              <Clock size={16} className="text-forum-light-gray" />
              {formatTime(event.datetime)}
              {event.endDatetime && ` - ${formatTime(event.endDatetime)}`}
            </div>
            <div className="flex items-center gap-[10px] text-[14px] font-dm-sans text-forum-dark-gray">
              <MapPin size={16} className="text-forum-light-gray" />
              {event.locationName}
            </div>
            {event.externalLink && (
              <a
                href={event.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-[10px] text-[14px] font-dm-sans text-forum-cerulean hover:underline"
              >
                <ExternalLink size={16} /> Register
              </a>
            )}
          </div>

          {/* Description */}
          <p className="text-[14px] font-dm-sans text-forum-dark-gray leading-relaxed whitespace-pre-wrap mb-[24px]">
            {event.description}
          </p>

          {/* RSVP button */}
          <Button
            variant={isRsvped ? "solid" : "coral"}
            size="cta"
            aria-pressed={isRsvped}
            disabled={isPending}
            onClick={handleRsvp}
            className="w-full max-w-[300px]"
          >
            {isRsvped ? "Cancel RSVP" : "RSVP now"}
          </Button>

          {/* Attendees */}
          <div className="flex items-center gap-[12px] mt-[16px]">
            {event.attendees.length > 0 && (
              <AvatarStack users={event.attendees} size={30} max={6} />
            )}
            <div>
              <div className="flex items-center gap-[6px]">
                <Users size={14} className="text-forum-light-gray" />
                <span className="text-[14px] font-bold font-dm-sans text-black">
                  {rsvpCount} attending
                </span>
              </div>
              {event.friendsAttending.length > 0 && (
                <p className="text-[12px] font-dm-sans text-forum-light-gray mt-[2px]">
                  {event.friendsAttending.map((f) => f.displayName).join(", ")}{" "}
                  {event.friendsAttending.length === 1 ? "is" : "are"} going
                </p>
              )}
            </div>
          </div>

          <p className="text-[12px] font-dm-sans text-forum-light-gray mt-[20px]">
            Posted by {event.creatorName}
          </p>
        </div>
      </div>

      {/* Similar Events */}
      {similarEvents.length > 0 && (
        <section className="mt-12 border-t border-forum-medium-gray pt-6">
          <SectionHeading>Similar Events</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {similarEvents.map((se) => (
              <Panel
                asChild
                key={se.id}
                size="sm"
                className="h-[120px] bg-forum-coral-bg transition-colors hover:border-forum-cerulean"
              >
                <Link href={`/events/${se.id}`} className="flex flex-col justify-between">
                  <p className="font-serif text-[16px] leading-tight text-black line-clamp-2">
                    {se.title}
                  </p>
                  <p className="font-dm-sans text-[12px] text-forum-light-gray">{se.datetime}</p>
                </Link>
              </Panel>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
