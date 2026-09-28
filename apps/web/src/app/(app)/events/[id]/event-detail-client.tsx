"use client";

import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  Check,
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
import { toggleFollowOrg, unblockOrg } from "~/actions/orgs";
import { OrgAvatar } from "~/components/common/org-avatar";
import { RichText } from "~/components/common/rich-text";
import { AttendeesDialog } from "~/components/events/attendees-dialog";
import { EventCoverArt } from "~/components/events/event-cover-art";
import { MiniEventList } from "~/components/events/mini-event-list";
import { PageShell, SectionHeading } from "~/components/layout/page-shell";
import { EventActionsMenu, hideOrgWithUndo } from "~/components/orgs/org-feed-menu";
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
import { buildGCalUrl } from "~/lib/calendar";
import { formatLongDate, formatTime } from "~/lib/date-format";
import { eventPhotoUrl } from "~/lib/event-media";
import { cn } from "~/lib/utils";

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
  /* Local, because the avatar stack below has to move with the RSVP button. */
  const [attendees, setAttendees] = useState(event.attendees);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isFollowingOrg, setIsFollowingOrg] = useState(event.isFollowingOrg);
  const [isOrgHidden, setIsOrgHidden] = useState(event.isOrgHidden);

  /*
   * Optimistic, then reconciled with the server. On failure the local state
   * rolls back and a toast says so — previously a failed RSVP left the button
   * claiming "You're going".
   */
  const handleRsvp = () => {
    const prev = { isRsvped, rsvpCount };
    setIsRsvped(!prev.isRsvped);
    setRsvpCount((c) => (prev.isRsvped ? c - 1 : c + 1));
    startTransition(async () => {
      try {
        const result = await toggleRsvp(event.id);
        setIsRsvped(result.rsvped);
        setRsvpCount(result.count);
        setAttendees(result.attendees);
        if (result.rsvped) toast.success(`You're going to ${event.title}`);
        else toast(`Removed your RSVP to ${event.title}`);
      } catch {
        setIsRsvped(prev.isRsvped);
        setRsvpCount(prev.rsvpCount);
        toast.error("Couldn't update your RSVP. Please try again.");
      }
    });
  };

  const handleSave = () => {
    const prev = isSaved;
    setIsSaved(!prev);
    startTransition(async () => {
      try {
        const result = await toggleSave(event.id);
        setIsSaved(result.saved);
      } catch {
        setIsSaved(prev);
        toast.error("Couldn't update saved events. Please try again.");
      }
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // Dismissing the share sheet rejects; nothing to report.
    }
  };

  /* Following unhides; hiding unfollows — mirrored locally. */
  const handleToggleFollowOrg = async () => {
    if (!event.orgId || !event.orgName) return;
    const prev = { isFollowingOrg, isOrgHidden };
    setIsFollowingOrg(!prev.isFollowingOrg);
    if (!prev.isFollowingOrg) setIsOrgHidden(false);
    try {
      const { following } = await toggleFollowOrg(event.orgId);
      setIsFollowingOrg(following);
      toast(
        following
          ? `Following ${event.orgName}. Their events will rank higher.`
          : `Unfollowed ${event.orgName}`,
      );
    } catch {
      setIsFollowingOrg(prev.isFollowingOrg);
      setIsOrgHidden(prev.isOrgHidden);
      toast.error("Couldn't update that follow. Please try again.");
    }
  };

  const handleHideOrg = () => {
    if (!event.orgId || !event.orgName) return;
    const wasFollowing = isFollowingOrg;
    void hideOrgWithUndo({
      orgId: event.orgId,
      orgName: event.orgName,
      onHidden: () => {
        setIsOrgHidden(true);
        setIsFollowingOrg(false);
      },
      onRestored: () => {
        setIsOrgHidden(false);
        setIsFollowingOrg(wasFollowing);
      },
    });
  };

  const handleUnhideOrg = async () => {
    if (!event.orgId || !event.orgName) return;
    setIsOrgHidden(false);
    try {
      await unblockOrg(event.orgId);
      toast(`Events from ${event.orgName} will show in your feed again`);
    } catch {
      setIsOrgHidden(true);
      toast.error("Couldn't update that. Please try again.");
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteEvent(event.id);
        router.push("/events");
      } catch {
        toast.error("Couldn't delete the event. Please try again.");
      }
    });
  };

  const photoUrl = eventPhotoUrl(event.flyerUrl);
  const when = `${formatTime(event.datetime)}${
    event.endDatetime ? ` – ${formatTime(event.endDatetime)}` : ""
  } ET`;

  return (
    <PageShell width="content">
      <Button variant="quiet" size="xs" onClick={() => router.back()} className="-ml-2 mb-3">
        <ChevronLeft />
        Back
      </Button>

      <div className="grid gap-6 rounded-[24px] border border-forum-border bg-white p-5 shadow-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:p-6 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* Flyer — a supporting image, not the page */}
        <div className="aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-2xl border border-forum-border">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Flyer for ${event.title}`}
              className="size-full object-cover"
            />
          ) : (
            <EventCoverArt title={event.title} tags={event.tags} className="size-full" />
          )}
        </div>

        <div className="min-w-0 font-dm-sans">
          <h1 className="font-serif text-[24px] font-semibold leading-tight text-black sm:text-[26px]">
            {event.title}
          </h1>
          {event.orgName && (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-forum-dark-gray">
              <OrgAvatar name={event.orgName} logoUrl={event.orgLogoUrl} size={28} />
              Hosted by
              {event.orgId ? (
                <Link
                  href={`/orgs/${event.orgId}`}
                  className="font-semibold text-forum-cerulean hover:underline"
                >
                  {event.orgName}
                </Link>
              ) : (
                <span className="font-semibold">{event.orgName}</span>
              )}
            </p>
          )}

          <dl className="mt-3 grid grid-cols-[18px_1fr] items-center gap-x-2 gap-y-1.5 text-[13px] text-forum-dark-gray">
            <dt>
              <Calendar size={14} aria-hidden className="text-forum-light-gray" />
              <span className="sr-only">Date</span>
            </dt>
            <dd>{formatLongDate(event.datetime)}</dd>
            <dt>
              <Clock size={14} aria-hidden className="text-forum-light-gray" />
              <span className="sr-only">Time</span>
            </dt>
            <dd>{when}</dd>
            <dt>
              <MapPin size={14} aria-hidden className="text-forum-light-gray" />
              <span className="sr-only">Location</span>
            </dt>
            <dd>
              {event.locationName}
              {event.locationDetail && (
                <span className="text-forum-light-gray"> · {event.locationDetail}</span>
              )}
            </dd>
            {event.externalLink && (
              <>
                <dt>
                  <ExternalLink size={14} aria-hidden className="text-forum-light-gray" />
                  <span className="sr-only">Link</span>
                </dt>
                <dd>
                  <a
                    href={event.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-forum-cerulean hover:underline"
                  >
                    Registration / more info
                  </a>
                </dd>
              </>
            )}
          </dl>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant={isRsvped ? "cerulean" : "coral"}
              size="sm"
              aria-pressed={isRsvped}
              disabled={isPending}
              onClick={handleRsvp}
              className="min-w-[96px]"
            >
              {isRsvped ? (
                <>
                  <Check />
                  Going
                </>
              ) : (
                "RSVP"
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={isSaved}
              onClick={handleSave}
              className={cn(isSaved && "border-forum-cerulean text-forum-cerulean")}
            >
              {isSaved ? <BookmarkCheck /> : <Bookmark />}
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={buildGCalUrl(event)} target="_blank" rel="noopener noreferrer">
                <Calendar /> Add to calendar
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 /> Share
            </Button>
            {event.orgId && event.orgName && (
              <EventActionsMenu
                eventTitle={event.title}
                org={{
                  name: event.orgName,
                  isFollowing: isFollowingOrg,
                  isHidden: isOrgHidden,
                  onToggleFollow: handleToggleFollowOrg,
                  onHide: handleHideOrg,
                  onUnhide: handleUnhideOrg,
                }}
                variant="outline"
              />
            )}
          </div>

          {/* Attendance */}
          <div className="mt-3 flex items-center gap-2 text-[12px] text-forum-dark-gray">
            {attendees.length > 0 && <AvatarStack users={attendees} size={22} max={5} />}
            <Users size={13} aria-hidden className="text-forum-light-gray" />
            <AttendeesDialog
              attendees={attendees}
              count={rsvpCount}
              friendIds={new Set(event.friendsAttending.map((f) => f.id))}
              className="text-[12px] font-medium text-forum-dark-gray"
            />
            {event.friendsAttending.length > 0 && (
              <span className="text-forum-coral">
                · {event.friendsAttending.map((f) => f.displayName).join(", ")}{" "}
                {event.friendsAttending.length === 1 ? "is" : "are"} going
              </span>
            )}
          </div>

          {event.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-forum-medium-gray/70 px-1.5 py-px text-[11px] text-forum-dark-gray"
                >
                  {tag}
                </span>
              ))}
              {!event.isPublic && (
                <span className="rounded bg-forum-orange/10 px-1.5 py-px text-[11px] font-semibold text-forum-orange">
                  Private
                </span>
              )}
            </div>
          )}

          <RichText text={event.description} className="mt-4" />

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-forum-border pt-3 text-[12px] text-forum-light-gray">
            {event.source === "myprincetonu" || event.source === "listserv" ? (
              <span>
                {event.source === "myprincetonu"
                  ? "Official event from MyPrincetonU"
                  : "Found in a campus listserv email"}
                {event.sourceUrl && (
                  <>
                    {" · "}
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forum-cerulean hover:underline"
                    >
                      {event.source === "myprincetonu" ? "View on MyPrincetonU" : "Read the email"}
                    </a>
                  </>
                )}
              </span>
            ) : (
              <span>Posted by {event.creatorName}</span>
            )}
            {/* Org owners/officers can edit; only the creator can delete. */}
            {event.canEdit && (
              <Link
                href={`/events/${event.id}/edit`}
                className="inline-flex items-center gap-1 font-medium text-forum-cerulean hover:underline"
              >
                <Edit3 size={12} aria-hidden /> Edit
              </Link>
            )}
            {event.isOwner && (
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-forum-coral hover:underline"
                  >
                    <Trash2 size={12} aria-hidden /> Delete
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete event</DialogTitle>
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
                      {isPending ? "Deleting…" : "Delete event"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {similarEvents.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Similar events</SectionHeading>
          <MiniEventList
            empty=""
            items={similarEvents.map((se) => ({
              id: se.id,
              title: se.title,
              meta: `${se.datetime} · ${se.location}`,
            }))}
          />
        </section>
      )}
    </PageShell>
  );
}
