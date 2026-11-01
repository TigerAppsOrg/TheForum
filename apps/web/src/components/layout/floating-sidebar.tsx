"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "~/components/layout/nav-items";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

const ITEM =
  "flex size-12 items-center justify-center rounded-[16px] text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean";

/**
 * The floating left sidebar from the Figma: a tall, detached, rounded card
 * with a pale turquoise → blush gradient and icon-only navigation. Every icon
 * has an accessible name and a tooltip (with its "g then …" shortcut). Log out
 * lives in the header's account menu.
 */
export function FloatingSidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "fixed top-4 bottom-4 left-4 z-40 hidden w-[76px] flex-col items-center py-5 md:flex",
        "rounded-[28px] border border-white/80",
        "bg-[linear-gradient(180deg,#d9f7f7_0%,#f2fcfc_38%,#fffafa_72%,#fff0f5_100%)]",
        "shadow-[0_10px_30px_rgba(10,156,213,0.12),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <nav className="flex flex-col items-center gap-3">
        {NAV_ITEMS.map(({ href, icon: Icon, label, shortcut }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  aria-keyshortcuts={`g ${shortcut}`}
                  className={cn(
                    ITEM,
                    active ? "bg-forum-turquoise shadow-sm" : "hover:bg-white/80",
                  )}
                >
                  <Icon size={24} strokeWidth={active ? 2.4 : 2} aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {label}
                <span className="ml-2 font-dm-mono text-[10px] opacity-70">
                  G {shortcut.toUpperCase()}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
