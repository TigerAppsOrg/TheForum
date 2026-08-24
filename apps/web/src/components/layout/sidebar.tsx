"use client";

import type { LucideIcon } from "lucide-react";
import { LogOut, Plus } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "~/components/layout/nav-items";
import { cn } from "~/lib/utils";

/**
 * Space reserved in the page flow: the 12px inset plus the *expanded* 200px
 * width, not the collapsed 64px.
 *
 * The panel overlays rather than pushes, so if we only reserved the collapsed
 * width the expanded panel would land on top of the page heading and the first
 * card. Reserving the open width means content always begins to the right of
 * where the panel can ever reach — nothing is covered, and nothing reflows on
 * hover. The cost is a fixed gutter beside the collapsed rail.
 *
 * The widths themselves are literal Tailwind classes below, because the JIT
 * scans source text and cannot read them out of a template string.
 */
const FOOTPRINT = 212;

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    /*
     * The outer element reserves a fixed slice of page flow and never resizes;
     * the panel inside is absolutely positioned and grows on hover. Animating
     * the flow width instead would re-wrap the feed on every pointer pass.
     */
    <div className="relative z-40 shrink-0" style={{ width: FOOTPRINT }}>
      <aside
        aria-label="Primary"
        className={cn(
          "group/rail absolute inset-y-3 left-3 flex flex-col overflow-hidden rounded-[16px]",
          "shadow-[0px_3px_3px_0px_rgba(32,162,255,0.08)]",
          "transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          "hover:shadow-[0px_8px_24px_0px_rgba(32,162,255,0.18)]",
          "focus-within:shadow-[0px_8px_24px_0px_rgba(32,162,255,0.18)]",
          "w-[64px] hover:w-[200px] focus-within:w-[200px]",
        )}
      >
        {/*
          Two backdrop layers. Collapsed, the white one is transparent so the
          geometric background still reads through the turquoise tint exactly as
          before. Expanded, it turns opaque so the panel can sit over page
          content without the feed showing through.
        */}
        <span
          aria-hidden
          className="absolute inset-0 bg-white opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 motion-reduce:transition-none"
        />
        <span aria-hidden className="absolute inset-0 bg-forum-turquoise-20" />

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

          {/*
            Event creation is a secondary action, not the product's headline
            flow — a quiet ghost item in the nav rather than a filled CTA.
          */}
          <Link
            href="/events/create"
            className={cn(
              "mt-2 flex items-center gap-[10px] rounded-[8px] px-[10px] py-[8px] font-dm-sans text-[13px] font-medium transition-colors",
              "text-forum-light-gray hover:bg-forum-turquoise/20 hover:text-forum-dark-gray",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
            )}
          >
            <NavRow icon={Plus} label="Create an event" iconSize={16} />
          </Link>
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
