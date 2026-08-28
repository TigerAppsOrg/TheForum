"use client";

import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "~/components/layout/nav-items";
import { cn } from "~/lib/utils";

/**
 * Row inside the nav.
 *
 * The icon lives in a fixed 20px slot and every row uses the same padding, so
 * icons sit on one vertical line at exactly the same x whether the rail is
 * collapsed or expanded — the labels grow to the right of a stationary icon
 * rather than the whole row sliding.
 */
function NavRow({
  icon: Icon,
  label,
  className,
  iconSize = 20,
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
  iconSize?: number;
}) {
  return (
    <>
      <span className="flex w-5 shrink-0 items-center justify-center">
        <Icon size={iconSize} strokeWidth={1.8} aria-hidden />
      </span>
      <span
        className={cn(
          "whitespace-nowrap opacity-0 transition-opacity duration-150",
          "group-hover/rail:opacity-100 group-focus-within/rail:opacity-100",
          "motion-reduce:transition-none",
          className,
        )}
      >
        {label}
      </span>
    </>
  );
}

export function Sidebar({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname();

  return (
    /*
     * The outer element holds the rail's slice of page flow and animates with
     * it, so page content is pushed rather than covered — matching the design,
     * where the greeting and search field shift right as the rail opens while
     * their right edge stays put.
     *
     * `floating` reserves nothing, letting the page beneath run the full width
     * of the shell — used by the map so its timeline can stretch edge to edge
     * while the rail simply sits on top.
     */
    <div
      className={cn(
        // Hidden on phones — `MobileNav` takes over there, because the
        // hover-to-expand interaction has no touch equivalent.
        "group/rail relative z-40 hidden shrink-0 md:block",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        floating ? "md:w-0" : "md:w-[76px] md:hover:w-[212px] md:focus-within:w-[212px]",
      )}
    >
      <aside
        aria-label="Primary"
        className={cn(
          "absolute left-3 flex flex-col overflow-hidden rounded-[16px]",
          // Sits 48px from the top and 112px from the bottom — same panel
          // height as an even 80/80 split, shifted up. The deeper bottom gap
          // also keeps the map's full-width timeline clear of the rail.
          "top-12 bottom-28",
          "shadow-[0px_3px_3px_0px_rgba(32,162,255,0.08)]",
          "transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          "group-hover/rail:shadow-[0px_8px_24px_0px_rgba(32,162,255,0.18)]",
          "group-focus-within/rail:shadow-[0px_8px_24px_0px_rgba(32,162,255,0.18)]",
          "w-[64px] group-hover/rail:w-[200px] group-focus-within/rail:w-[200px]",
        )}
      >
        {/* Rail backdrop — #ECFCFC at 50%. */}
        <span aria-hidden className="absolute inset-0 bg-[#ECFCFC]/50" />

        <nav className="relative flex flex-1 flex-col gap-[6px] px-[12px] pt-[14px]">
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const isActive = isNavItemActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-[10px] rounded-[8px] px-[10px] py-[8px] font-dm-sans text-[14px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
                  isActive
                    ? "bg-forum-turquoise text-black"
                    : "text-black hover:bg-forum-turquoise/30",
                )}
              >
                <NavRow icon={icon} label={label} />
              </Link>
            );
          })}
        </nav>

        <div className="relative mb-3 px-[12px]">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn(
              "flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[8px] font-inter text-[14px] font-semibold transition-colors",
              "text-forum-light-gray hover:bg-forum-turquoise/20 hover:text-forum-dark-gray",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
            )}
          >
            <NavRow icon={LogOut} label="Log Out" iconSize={18} />
          </button>
        </div>
      </aside>
    </div>
  );
}
