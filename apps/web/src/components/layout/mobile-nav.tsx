"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "~/components/layout/nav-items";
import { cn } from "~/lib/utils";

/**
 * Bottom tab bar for phones.
 *
 * Below `md` the header's inline nav is hidden and this takes over: every
 * destination visible at once, thumb-height, with labels always shown.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the tabs clear of the iOS home
 * indicator.
 *
 * Log Out is deliberately not a tab — it's in the header's account menu, so
 * it can't be hit by a stray thumb aiming for Orgs.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        "border-t border-forum-border bg-white pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-2px_12px_rgba(0,0,0,0.06)]",
      )}
    >
      <ul className="flex items-stretch">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = isNavItemActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5",
                  "font-dm-sans text-[10px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forum-cerulean",
                  isActive ? "text-forum-cerulean" : "text-forum-light-gray",
                )}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden />
                <span className="w-full truncate text-center leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
