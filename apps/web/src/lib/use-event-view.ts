"use client";

import { useCallback, useEffect, useState } from "react";

export type EventView = "cards" | "rows";

const STORAGE_KEY = "forum:event-view";

/**
 * Cards (the Figma look) or compact rows (the TigerInbox look), remembered per
 * browser. Storage can be unavailable (private windows, blocked site data), so
 * every access is guarded and the default is used on failure.
 */
export function useEventView(defaultView: EventView = "cards") {
  const [view, setViewState] = useState<EventView>(defaultView);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "cards" || stored === "rows") setViewState(stored);
    } catch {
      // ignore — fall back to the default
    }
  }, []);

  const setView = useCallback((next: EventView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — the choice just won't persist
    }
  }, []);

  return [view, setView] as const;
}
