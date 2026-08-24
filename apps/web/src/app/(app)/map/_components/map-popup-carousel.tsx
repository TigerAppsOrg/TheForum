"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { MapEvent } from "~/actions/map";
import { MapPopup } from "./map-popup";

interface MapPopupCarouselProps {
  events: MapEvent[];
  onExpand: (eventId: string) => void;
}

export function MapPopupCarousel({ events, onExpand }: MapPopupCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = events[activeIndex];
  if (!current) return null;

  return (
    <div className="relative">
      <MapPopup event={current} onExpand={() => onExpand(current.id)} />

      {events.length > 1 && (
        <>
          {/* Left arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex((i) => (i - 1 + events.length) % events.length);
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 shadow-sm border border-forum-border flex items-center justify-center text-forum-dark-gray hover:text-black hover:bg-white transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Right arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex((i) => (i + 1) % events.length);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 shadow-sm border border-forum-border flex items-center justify-center text-forum-dark-gray hover:text-black hover:bg-white transition-colors"
          >
            <ChevronRight size={14} />
          </button>

          {/* Pagination dots */}
          <div className="flex items-center justify-center gap-1 pb-2">
            {events.map((evt, i) => (
              <button
                key={evt.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(i);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === activeIndex ? "bg-gray-800" : "bg-forum-medium-gray"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
