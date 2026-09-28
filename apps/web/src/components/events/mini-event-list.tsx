import Link from "next/link";
import type * as React from "react";

export interface MiniEventItem {
  id: string;
  title: string;
  /** One muted line under the title, e.g. "Tomorrow · Frist". */
  meta: React.ReactNode;
  /** Optional leading line above the title, e.g. "Maya is going". */
  eyebrow?: React.ReactNode;
}

/**
 * Dense sidebar list of events — title links to the event, one meta line.
 * Shared by Explore's "Friends going" and "Saved" panels.
 */
export function MiniEventList({ items, empty }: { items: MiniEventItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="font-dm-sans text-[12px] text-forum-light-gray">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.id} className="min-w-0 font-dm-sans">
          {item.eyebrow && (
            <p className="truncate text-[11px] font-medium text-forum-coral">{item.eyebrow}</p>
          )}
          <Link
            href={`/events/${item.id}`}
            className="block truncate text-[13px] font-semibold text-black hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
          >
            {item.title}
          </Link>
          <p className="truncate text-[11px] text-forum-light-gray">{item.meta}</p>
        </li>
      ))}
    </ul>
  );
}
