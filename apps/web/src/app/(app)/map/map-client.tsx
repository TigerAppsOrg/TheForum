"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { MapRef } from "react-map-gl/mapbox";
import type { MapEvent } from "~/actions/map";
import { cn } from "~/lib/utils";
import { getTimeGroup } from "./_lib/map-helpers";

/* Dynamic import for MapView — mapbox-gl accesses `window` at module init */
const MapView = dynamic(
  () => import("./_components/map-view").then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-forum-medium-gray">
        <div className="flex flex-col items-center gap-2">
          <div className="size-7 animate-spin rounded-full border-2 border-forum-border border-t-forum-cerulean" />
          <span className="font-dm-sans text-xs font-medium text-forum-light-gray">
            Loading map
          </span>
        </div>
      </div>
    ),
  },
);

/* Lazy-load overlay components */
const MapSearchBar = dynamic(
  () => import("./_components/map-search-bar").then((m) => ({ default: m.MapSearchBar })),
  { ssr: false },
);
const MapFilterPills = dynamic(
  () => import("./_components/map-filter-pills").then((m) => ({ default: m.MapFilterPills })),
  { ssr: false },
);
const TimelineScrubber = dynamic(
  () => import("./_components/timeline-scrubber").then((m) => ({ default: m.TimelineScrubber })),
  { ssr: false },
);
const EventListPanel = dynamic(
  () => import("./_components/event-list-panel").then((m) => ({ default: m.EventListPanel })),
  { ssr: false },
);
const EventDetailModal = dynamic(
  () => import("./_components/event-detail-modal").then((m) => ({ default: m.EventDetailModal })),
  { ssr: false },
);

/* ═══ Filter types ═══ */
export type FilterKey = "friends" | "now" | "attending";

/* ═══ Component ═══ */
interface MapClientProps {
  initialEvents: MapEvent[];
}

export function MapClient({ initialEvents }: MapClientProps) {
  const mapRef = useRef<MapRef>(null);
  const [isPending, startTransition] = useTransition();

  /* Data */
  const [events, setEvents] = useState(initialEvents);

  /* Filters */
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* Map interaction */
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  /* Panel / Modal */
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);

  /* ═══ Derived state ═══ */
  const filteredEvents = useMemo(() => {
    let result = events;
    if (selectedDate) {
      result = result.filter((e) => e.rawDatetime.startsWith(selectedDate));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.locationName.toLowerCase().includes(q) ||
          e.orgName?.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (activeFilters.has("now")) {
      result = result.filter((e) => getTimeGroup(e.rawDatetime) === "now");
    }
    return result;
  }, [events, selectedDate, searchQuery, activeFilters]);

  const locationGroups = useMemo(() => {
    const groups = new Map<string, MapEvent[]>();
    for (const event of filteredEvents) {
      const group = groups.get(event.locationId);
      if (group) group.push(event);
      else groups.set(event.locationId, [event]);
    }
    return groups;
  }, [filteredEvents]);

  /*
   * The sidebar shows the events at the pin you clicked — not the whole
   * filtered set. Clicking a pin with four events shows those four.
   */
  const panelEvents = useMemo(
    () => (selectedLocation ? (locationGroups.get(selectedLocation) ?? []) : []),
    [selectedLocation, locationGroups],
  );

  const eventCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const d = event.rawDatetime.slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  /* ═══ Callbacks ═══ */
  const toggleFilter = useCallback((key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelectDate = useCallback((dateStr: string | null) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
    setSelectedLocation(null);
  }, []);

  /** A single event at a pin → open the full detail card. */
  const handleExpandEvent = useCallback((eventId: string) => {
    setDetailEventId(eventId);
  }, []);

  /** Several events at a pin → open the sidebar listing them. */
  const handleShowLocationList = useCallback((locId: string) => {
    setSelectedLocation(locId);
    setPanelOpen(true);
  }, []);

  const handleLocateEvent = useCallback((event: MapEvent) => {
    setSelectedLocation(event.locationId);
    mapRef.current?.flyTo({
      center: [event.longitude, event.latitude],
      zoom: 17,
      duration: 500,
    });
  }, []);

  return (
    <>
      {/*
        Fills the app shell's content area rather than the viewport. It used to
        be `fixed inset-0 z-40` with its own floating mini-nav, which meant the
        map painted over the docked Sidebar and the route had to opt out of the
        standard chrome. It now shares the same nav as every other page.
      */}
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {/* Map area — everything that floats is scoped to this box, so no overlay
            can land on the timeline below it */}
        <div className="relative min-h-0 flex-1">
          <MapView
            ref={mapRef}
            locationGroups={locationGroups}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            onExpandEvent={handleExpandEvent}
            onShowLocationList={handleShowLocationList}
          />

          {/* ═══ Search bar + filter pills (top center) ═══ */}
          {/*
            The rail floats over the map on this route, so the left inset clears
            its *expanded* 212px width — the controls are never swallowed when it
            opens. The wider right inset on ≥sm clears the TopBar's bell + avatar.
          */}
          <div className="pointer-events-none absolute top-4 right-4 left-4 z-10 sm:left-[224px] sm:right-32">
            <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
              <MapSearchBar value={searchQuery} onChange={setSearchQuery} />
              <MapFilterPills activeFilters={activeFilters} onToggle={toggleFilter} />
            </div>
          </div>

          {/* ═══ Right-side floating event cards ═══ */}
          {/* No panel chrome — the cards themselves are the surface, so the map
              shows through the gaps between them. */}
          <div
            className={cn(
              // Full width on phones — a 320px rail leaves too little map beside
              // it to be worth keeping.
              "absolute top-16 right-0 bottom-0 z-10 w-full transition-transform duration-300 ease-out sm:w-[320px]",
              panelOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <EventListPanel
              events={panelEvents}
              locationName={panelEvents[0]?.locationName ?? ""}
              expandedEventId={detailEventId}
              onLocateEvent={handleLocateEvent}
              onExpandEvent={handleExpandEvent}
              onClose={() => {
                setPanelOpen(false);
                setSelectedLocation(null);
              }}
            />
          </div>

          {/* ═══ Loading overlay ═══ */}
          {isPending && (
            <output className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
              <span className="flex items-center gap-2 rounded-xl border border-forum-border bg-white/95 px-4 py-2 shadow-lg">
                <span className="size-2 animate-pulse rounded-full bg-forum-cerulean" />
                <span className="font-dm-sans text-xs font-medium text-forum-dark-gray">
                  Loading events
                </span>
              </span>
            </output>
          )}
        </div>

        {/* ═══ Timeline scrubber — a bar beneath the map, not an overlay on it ═══ */}
        <div className="shrink-0">
          <TimelineScrubber
            days={14}
            eventCountByDate={eventCountByDate}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        </div>
      </div>

      {/* ═══ Event detail modal ═══ */}
      <EventDetailModal eventId={detailEventId} onClose={() => setDetailEventId(null)} />
    </>
  );
}
