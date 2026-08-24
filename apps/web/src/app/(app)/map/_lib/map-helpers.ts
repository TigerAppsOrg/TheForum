import type { RelativeLabel, TimeGroup } from "./map-types";

/* ═══ Tag colors ═══ */
export const TAG_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  "free food": { dot: "#ea580c", bg: "#fff7ed", text: "#c2410c" },
  "performing arts": { dot: "#db2777", bg: "#fdf2f8", text: "#be185d" },
  "speaker event": { dot: "#0891b2", bg: "#ecfeff", text: "#0e7490" },
  "social event": { dot: "#e11d48", bg: "#fff1f2", text: "#be123c" },
  career: { dot: "#059669", bg: "#ecfdf5", text: "#047857" },
  athletics: { dot: "#16a34a", bg: "#f0fdf4", text: "#15803d" },
  music: { dot: "#9333ea", bg: "#faf5ff", text: "#7e22ce" },
  "visual arts": { dot: "#ec4899", bg: "#fdf2f8", text: "#db2777" },
  academics: { dot: "#2563eb", bg: "#eff6ff", text: "#1d4ed8" },
  culture: { dot: "#ca8a04", bg: "#fefce8", text: "#a16207" },
  "community service": { dot: "#0d9488", bg: "#f0fdfa", text: "#0f766e" },
  religion: { dot: "#7c3aed", bg: "#f5f3ff", text: "#6d28d9" },
  politics: { dot: "#dc2626", bg: "#fef2f2", text: "#b91c1c" },
  tech: { dot: "#4f46e5", bg: "#eef2ff", text: "#4338ca" },
  gaming: { dot: "#65a30d", bg: "#f7fee7", text: "#4d7c0f" },
  outdoors: { dot: "#059669", bg: "#ecfdf5", text: "#047857" },
  wellness: { dot: "#d97706", bg: "#fffbeb", text: "#b45309" },
  research: { dot: "#0369a1", bg: "#f0f9ff", text: "#075985" },
  entrepreneurship: { dot: "#c026d3", bg: "#fdf4ff", text: "#a21caf" },
  literature: { dot: "#92400e", bg: "#fffbeb", text: "#78350f" },
  sustainability: { dot: "#15803d", bg: "#f0fdf4", text: "#166534" },
  stem: { dot: "#155e75", bg: "#ecfeff", text: "#164e63" },
};
const DEFAULT_TAG = { dot: "#64748b", bg: "#f8fafc", text: "#475569" };

export function getEventColor(tags: string[]) {
  for (const tag of tags) {
    const c = TAG_COLORS[tag];
    if (c) return c;
  }
  return DEFAULT_TAG;
}

/* ═══ Time helpers ═══ */
export function getTimeGroup(rawDatetime: string): TimeGroup {
  const eventTime = new Date(rawDatetime).getTime();
  const now = Date.now();
  const diffMs = eventTime - now;
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffMs < 0 && diffMs > -2 * 60 * 60 * 1000) return "now";
  if (diffH <= 0) return "later-today";
  if (diffH <= 3) return "soon";

  const eventDay = new Date(rawDatetime);
  const today = new Date();
  eventDay.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) return "later-today";
  if (dayDiff === 1) return "tomorrow";
  return "this-week";
}

export function getRelativeLabel(rawDatetime: string): RelativeLabel {
  const eventTime = new Date(rawDatetime);
  const now = new Date();
  const diffMs = eventTime.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / (1000 * 60));
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  const group = getTimeGroup(rawDatetime);

  if (group === "now") return { label: "NOW", urgency: "now" };
  if (diffMin > 0 && diffMin < 60) return { label: `${diffMin}m`, urgency: "soon" };
  if (diffH > 0 && diffH <= 3) return { label: `${diffH}h`, urgency: "soon" };

  const eventDay = new Date(rawDatetime);
  const today = new Date();
  eventDay.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) {
    return {
      label: eventTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      urgency: "later-today",
    };
  }
  if (dayDiff === 1) {
    return {
      label: `Tmrw ${eventTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      urgency: "tomorrow",
    };
  }
  return {
    label: eventTime.toLocaleDateString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
    urgency: "this-week",
  };
}

export const GROUP_LABELS: Record<TimeGroup, string> = {
  now: "Happening Now",
  soon: "Starting Soon",
  "later-today": "Later Today",
  tomorrow: "Tomorrow",
  "this-week": "This Week",
};

export const GROUP_ORDER: TimeGroup[] = ["now", "soon", "later-today", "tomorrow", "this-week"];

export const URGENCY_STYLES: Record<TimeGroup, { badge: string; text: string }> = {
  now: { badge: "bg-[rgba(255,156,133,0.25)] text-[#FF7151]", text: "text-[#FF7151]" },
  soon: { badge: "bg-[rgba(254,232,130,0.5)] text-[#854d0e]", text: "text-[#854d0e]" },
  "later-today": { badge: "bg-[rgba(162,239,240,0.2)] text-[#0A9CD5]", text: "text-[#0A9CD5]" },
  tomorrow: { badge: "bg-forum-medium-gray text-forum-dark-gray", text: "text-[#585858]" },
  "this-week": { badge: "bg-forum-medium-gray text-forum-light-gray", text: "text-[#767676]" },
};

/* ═══ Date helpers ═══ */
export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}

export function getTimelineDays(days: number): {
  dateStr: string;
  dayName: string;
  dayNum: number;
  monthShort: string;
  isToday: boolean;
  isPast: boolean;
}[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: {
    dateStr: string;
    dayName: string;
    dayNum: number;
    monthShort: string;
    isToday: boolean;
    isPast: boolean;
  }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = toDateStr(d);
    result.push({
      dateStr,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
      monthShort: d.toLocaleDateString("en-US", { month: "short" }),
      isToday: i === 0,
      isPast: false,
    });
  }
  return result;
}
