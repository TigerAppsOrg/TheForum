import { Bookmark, Clock, MapPin, Maximize2, Share2, Users, Zap } from "lucide-react";
import { AvatarStack } from "~/components/social/avatar-stack";
import { cn } from "~/lib/utils";

/*
 * Static product previews for the landing page.
 *
 * Built from the same classes as the real EventCard, FilterChip and map list
 * so the landing page shows what the app actually looks like — but as plain
 * server markup: no interaction logging, no links, nothing clickable. The
 * events are obviously sample content and are captioned as such.
 */

type SampleEvent = {
  org: string;
  title: string;
  location: string;
  when: string;
  tags: string[];
  friends: { id: string; displayName: string }[];
  friendLine: string;
};

const SAMPLE_EVENTS: SampleEvent[] = [
  {
    org: "Sample Student Group",
    title: "Study Break: Bubble Tea & Board Games",
    location: "Frist Campus Center",
    when: "Thu, Oct 8 at 9:00 PM",
    tags: ["free food", "social event"],
    friends: [
      { id: "sample-maya", displayName: "Maya" },
      { id: "sample-jordan", displayName: "Jordan" },
      { id: "sample-ari", displayName: "Ari" },
    ],
    friendLine: "Maya, Jordan + 1 other",
  },
  {
    org: "Sample Speaker Series",
    title: "Fireside Chat: Building Things Students Use",
    location: "Friend Center",
    when: "Fri, Oct 9 at 4:30 PM",
    tags: ["tech", "speaker event"],
    friends: [{ id: "sample-sam", displayName: "Sam" }],
    friendLine: "Sam",
  },
];

function SampleEventCard({ event, className }: { event: SampleEvent; className?: string }) {
  const going = event.friends.length === 1 ? "is going!" : "are going!";
  return (
    <div
      className={cn(
        "card flex w-full flex-col gap-0.5 rounded-xl px-5 py-5 text-left shadow-lg",
        className,
      )}
    >
      <div className="-mx-1 flex items-center justify-between text-forum-coral">
        <div className="flex items-center gap-3">
          <Bookmark size={16} />
          <Share2 size={16} />
        </div>
        <Maximize2 size={16} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="size-6 shrink-0 rounded border-2 border-forum-medium-gray bg-forum-turquoise/30" />
        <p className="truncate font-dm-sans text-[12px] font-bold text-forum-dark-gray">
          {event.org}
        </p>
      </div>

      <h3 className="mt-1 font-serif text-[18px] leading-[1.2] text-black">{event.title}</h3>

      <div className="mt-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="shrink-0 text-forum-light-gray" />
          <span className="font-dm-sans text-[12px] text-forum-dark-gray">{event.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="shrink-0 text-forum-light-gray" />
          <span className="font-dm-sans text-[12px] text-forum-dark-gray">{event.when}</span>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {event.tags.map((tag, i) => (
          <span
            key={tag}
            className={cn(
              "rounded-[10px] px-2 py-px font-dm-sans text-[12px] text-black",
              i === 0 ? "bg-forum-yellow-50" : "bg-forum-turquoise-50",
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <AvatarStack users={event.friends} size={26} max={3} />
        <p className="font-dm-sans text-[12px] leading-tight text-forum-dark-gray">
          <span className="font-bold text-forum-coral">{event.friendLine}</span> {going}
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <span className="rounded-full bg-forum-coral px-6 py-1.5 font-dm-sans text-[13px] font-medium text-white">
          RSVP
        </span>
      </div>
    </div>
  );
}

/** Two overlapping feed cards — "your feed, with your friends in it". */
export function FeedPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-sm">
      <div aria-hidden className="relative">
        <SampleEventCard
          event={SAMPLE_EVENTS[1] as SampleEvent}
          className="absolute inset-x-6 top-0 w-auto -rotate-3 opacity-90"
        />
        <SampleEventCard
          event={SAMPLE_EVENTS[0] as SampleEvent}
          className="relative mt-10 rotate-1"
        />
      </div>
      <figcaption className="mt-4 text-center font-dm-sans text-[11px] font-medium text-forum-black/60">
        <span className="sr-only">
          Preview of the Explore feed: event cards showing the time, place, topic tags and which
          friends are going.{" "}
        </span>
        Sample events shown for illustration
      </figcaption>
    </figure>
  );
}

const TONIGHT = [
  {
    label: "NOW",
    tone: "bg-forum-coral-light text-forum-coral",
    title: "Open Mic Night",
    place: "Sample Café",
  },
  {
    label: "45m",
    tone: "bg-forum-yellow-50 text-[#854d0e]",
    title: "Free Pizza + Info Session",
    place: "Sample Hall",
  },
  {
    label: "8:00 PM",
    tone: "bg-forum-turquoise-20 text-forum-cerulean",
    title: "A Cappella Showcase",
    place: "Sample Theater",
  },
] as const;

/** Filter chips over a "happening soon" list, echoing the map's event rail. */
export function TonightPreview() {
  return (
    <figure className="relative z-10 w-full max-w-sm">
      <div aria-hidden className="rounded-xl border border-white/60 bg-white/95 p-4 shadow-lg">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-forum-cerulean px-3.5 font-dm-sans text-[12px] font-medium text-white">
            <Zap size={13} />
            Happening Now
          </span>
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-forum-border bg-white px-3.5 font-dm-sans text-[12px] font-medium text-forum-dark-gray">
            <Users size={13} />
            Friends Going
          </span>
          <span className="inline-flex h-[30px] items-center rounded-full border border-forum-border bg-white px-3.5 font-dm-sans text-[12px] font-medium text-forum-dark-gray">
            free food
          </span>
        </div>

        <p className="mb-2 flex items-center gap-2 font-serif text-[16px] font-bold text-black">
          <span className="size-[9px] rounded-full bg-forum-cerulean" />
          Tonight near you
        </p>
        <ul className="divide-y divide-forum-medium-gray">
          {TONIGHT.map((row) => (
            <li key={row.title} className="flex items-center gap-3 py-2.5">
              <span
                className={cn(
                  "w-[64px] shrink-0 rounded-md py-1 text-center font-dm-sans text-[10px] font-bold tracking-wide",
                  row.tone,
                )}
              >
                {row.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-dm-sans text-[13px] font-bold text-black">
                  {row.title}
                </span>
                <span className="flex items-center gap-1 font-dm-sans text-[11px] text-forum-light-gray">
                  <MapPin size={10} />
                  {row.place}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-right font-dm-sans text-[11px] font-medium text-forum-black/60">
        <span className="sr-only">
          Preview of filtering events by what&apos;s happening now and what friends are going to.{" "}
        </span>
        Sample events shown for illustration
      </figcaption>
    </figure>
  );
}
