import {
  Building2,
  CalendarDays,
  Home,
  type LucideIcon,
  Map as MapIcon,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

/**
 * Single source of truth for primary navigation.
 *
 * Both the docked `Sidebar` and the map route's floating mini-nav read from
 * this list — previously they were separate arrays and had already drifted
 * (the map nav was missing Orgs entirely).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/explore", icon: Home, label: "Home" },
  { href: "/events", icon: CalendarDays, label: "My Events" },
  { href: "/map", icon: MapIcon, label: "Map" },
  { href: "/friends", icon: Users, label: "My Friends" },
  { href: "/orgs", icon: Building2, label: "Orgs" },
];

/**
 * Whether `href` is the active nav entry for `pathname`.
 *
 * Exact match or a `/`-delimited descendant, so `/events` does not light up for
 * a hypothetical `/events-archive` route the way a bare `startsWith` would.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
