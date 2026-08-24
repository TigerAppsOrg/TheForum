"use client";

import { Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FeedEvent } from "~/actions/events";
import { Panel } from "~/components/common/panel";
import { EmptyState } from "~/components/common/states";
import { EventCoverArt } from "~/components/events/event-cover-art";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const TABS = [
  {
    id: "created",
    label: "Events Created",
    emptyTitle: "No events created yet",
    emptyBody: "Share something with campus — create your first event.",
  },
  {
    id: "rsvped",
    label: "Events RSVP'd",
    emptyTitle: "No RSVP'd events",
    emptyBody: "Events you've RSVP'd to will show up here.",
  },
  {
    id: "saved",
    label: "Events Saved",
    emptyTitle: "No saved events",
    emptyBody: "Bookmark events you're interested in.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface MyEventsClientProps {
  created: FeedEvent[];
  rsvped: FeedEvent[];
  saved: FeedEvent[];
}

function EventListCard({ event }: { event: FeedEvent }) {
  return (
    <Panel
      asChild
      size="sm"
      className="transition-colors hover:border-forum-cerulean focus-within:border-forum-cerulean"
    >
      <Link href={`/events/${event.id}`} className="flex gap-4">
        {/* Flyer thumbnail */}
        <div className="h-[140px] w-[200px] shrink-0 overflow-hidden rounded-lg">
          {event.flyerUrl ? (
            <img src={event.flyerUrl} alt="" className="size-full object-cover" />
          ) : (
            <EventCoverArt title={event.title} tags={event.tags} className="size-full rounded-lg" />
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="mb-2 font-serif text-[20px] leading-tight text-black line-clamp-2">
            {event.title}
          </h3>

          <div className="mb-1 flex items-center gap-1.5">
            <Clock size={13} aria-hidden className="shrink-0 text-forum-dark-gray" />
            <span className="font-dm-sans text-[14px] text-forum-dark-gray">{event.datetime}</span>
          </div>

          <div className="mb-2 flex items-center gap-1.5">
            <MapPin size={13} aria-hidden className="shrink-0 text-forum-dark-gray" />
            <span className="font-dm-sans text-[14px] text-forum-dark-gray">{event.location}</span>
          </div>

          {event.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-2">
              {event.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-forum-yellow-50 px-2.5 py-0.5 font-dm-sans text-[13px] text-black"
                >
                  {tag}
                </span>
              ))}
              {event.orgName && (
                <span className="rounded-full bg-forum-turquoise-50 px-2.5 py-0.5 font-dm-sans text-[13px] text-black">
                  {event.orgName}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </Panel>
  );
}

export function MyEventsClient({ created, rsvped, saved }: MyEventsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("created");

  const eventMap: Record<TabId, FeedEvent[]> = { created, rsvped, saved };

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
      <TabsList variant="line" className="h-auto w-full border-b border-forum-medium-gray">
        {TABS.map(({ id, label }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="flex-1 py-4 font-dm-sans text-[18px] font-semibold after:bottom-[-1px] after:h-0.5 after:bg-forum-cerulean data-[state=active]:text-black"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map(({ id, emptyTitle, emptyBody }) => (
        <TabsContent key={id} value={id} className="mt-6">
          {eventMap[id].length > 0 ? (
            <div className="flex flex-col gap-4">
              {eventMap[id].map((event) => (
                <EventListCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState title={emptyTitle} description={emptyBody} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
