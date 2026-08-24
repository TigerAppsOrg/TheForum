"use client";

import { useMemo } from "react";
import { cn } from "~/lib/utils";
import { FUTURE_COLOR, NOW_COLOR } from "../_lib/map-constants";
import { getTimelineDays } from "../_lib/map-helpers";

interface TimelineScrubberProps {
  days: number;
  eventCountByDate: Map<string, number>;
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
}

export function TimelineScrubber({
  days,
  eventCountByDate,
  selectedDate,
  onSelectDate,
}: TimelineScrubberProps) {
  const timelineDays = useMemo(() => getTimelineDays(days), [days]);

  return (
    <div className="bg-white border-t border-forum-border px-4 py-3 flex items-center gap-6">
      {/* Legend */}
      <div className="shrink-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NOW_COLOR }} />
          <span className="text-[10px] font-bold text-forum-dark-gray tracking-wide">NOW</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FUTURE_COLOR }} />
          <span className="text-[10px] font-bold text-forum-dark-gray tracking-wide">FUTURE</span>
        </div>
      </div>

      {/* Timeline track */}
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="relative flex items-start min-w-max">
          {/* Background track line */}
          <div className="absolute top-[9px] left-0 right-0 h-[3px] bg-forum-medium-gray rounded-full" />

          {/* Filled track segments between dates with events */}
          {timelineDays.map((day, i) => {
            if (i === 0) return null;
            const prevDay = timelineDays[i - 1];
            const prevHasEvents = prevDay
              ? (eventCountByDate.get(prevDay.dateStr) ?? 0) > 0
              : false;
            const currHasEvents = (eventCountByDate.get(day.dateStr) ?? 0) > 0;

            if (!prevHasEvents || !currHasEvents) return null;

            return (
              <div
                key={`seg-${day.dateStr}`}
                className="absolute top-[7px] h-[7px] rounded-full bg-forum-medium-gray"
                style={{
                  left: `${(i - 1) * 72 + 9}px`,
                  width: "72px",
                }}
              />
            );
          })}

          {/* Date nodes */}
          <div className="relative flex items-start gap-0">
            {timelineDays.map((day) => {
              const count = eventCountByDate.get(day.dateStr) ?? 0;
              const isSelected = selectedDate === day.dateStr;
              const hasEvents = count > 0;

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => onSelectDate(day.dateStr)}
                  className="flex flex-col items-center w-[72px] group"
                >
                  {/* Circle node */}
                  <div
                    className={cn(
                      "rounded-full transition-all border-2",
                      isSelected
                        ? "w-[18px] h-[18px] bg-forum-cerulean border-forum-cerulean shadow-md shadow-forum-cerulean/20"
                        : hasEvents
                          ? "w-[14px] h-[14px] bg-forum-light-gray border-white shadow-sm"
                          : "w-[10px] h-[10px] bg-forum-medium-gray border-white mt-[2px]",
                    )}
                  />

                  {/* Date labels */}
                  <span
                    className={cn(
                      "text-[9px] font-bold mt-1.5 uppercase tracking-wider leading-none",
                      isSelected
                        ? "text-forum-cerulean"
                        : day.isToday
                          ? "text-forum-cerulean"
                          : hasEvents
                            ? "text-forum-dark-gray"
                            : "text-forum-light-gray",
                    )}
                  >
                    {day.isToday ? "TODAY" : day.dayName}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] leading-none mt-px",
                      isSelected
                        ? "text-forum-cerulean font-bold"
                        : hasEvents
                          ? "text-forum-dark-gray"
                          : "text-forum-light-gray",
                    )}
                  >
                    {day.monthShort} {String(day.dayNum).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
