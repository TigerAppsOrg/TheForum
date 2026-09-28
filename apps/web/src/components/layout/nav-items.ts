import { Building2, CalendarDays, Home, type LucideIcon, MapPin, Users } from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Second key of the "g then …" keyboard shortcut. */
  shortcut: string;
}

/**
 * Single source of truth for primary navigation — read by the floating
 * sidebar, the phone tab bar and the keyboard shortcuts, so they never drift.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/explore", icon: Home, label: "Home", shortcut: "h" },
  { href: "/events", icon: CalendarDays, label: "My Events", shortcut: "e" },
  { href: "/map", icon: MapPin, label: "Map", shortcut: "m" },
  { href: "/friends", icon: Users, label: "Friends", shortcut: "f" },
  { href: "/orgs", icon: Building2, label: "Organizations", shortcut: "o" },
];

/**
 * Whether `href` is the active nav entry for `pathname`.
 *
 * Exact match or a `/`-delimited descendant, so `/events` does not light up for
 * a hypothetical `/events-archive` route the way a bare `startsWith` would.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  // Event pages are usually opened from Home, so only /events itself is "My Events".
  if (href === "/events") return pathname === "/events";
  return pathname === href || pathname.startsWith(`${href}/`);
}
