"use client";

import { useCallback, useEffect, useState } from "react";

/** "calendar" is only offered on My Events. */
export type EventView = "cards" | "rows" | "calendar";

/**
 * Cards (the Figma look) or compact rows (the TigerInbox look), remembered per
 * page per browser — Home defaults to cards, My Events to rows. Storage can be
 * unavailable (private windows, blocked site data), so every access is guarded
 * and the default is used on failure.
 */
export function useEventView(page: string, defaultView: EventView) {
  const storageKey = `forum:event-view:${page}`;
  const [view, setViewState] = useState<EventView>(defaultView);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "cards" || stored === "rows" || stored === "calendar") setViewState(stored);
    } catch {
      // ignore — fall back to the default
    }
  }, [storageKey]);

  const setView = useCallback(
    (next: EventView) => {
      setViewState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // ignore — the choice just won't persist
      }
    },
    [storageKey],
  );

  return [view, setView] as const;
}
