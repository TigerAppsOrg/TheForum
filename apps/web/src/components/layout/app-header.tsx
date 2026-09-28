"use client";

import { FileText, LogOut, Plus, Settings, Shield } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "~/components/layout/nav-items";
import { NotificationDropdown } from "~/components/layout/notification-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

/**
 * The app's single, compact header: wordmark, primary nav, create, bell and
 * account menu — in the spirit of PrincetonCourses / TigerJunction. It replaces
 * the hover-to-expand side rail and the floating top bar, which every page had
 * to pad around (`TOP_BAR_CLEARANCE`).
 *
 * On phones the nav moves to the bottom tab bar (`MobileNav`). Log out lives in
 * the account menu, never as a nav item.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.netId ?? "";
  const netId = session?.user?.netId;
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <header className="z-30 flex h-12 shrink-0 items-center gap-4 border-b border-forum-border bg-white px-3 sm:px-5">
      <Link
        href="/explore"
        className="shrink-0 rounded font-serif text-[20px] italic leading-none tracking-tight text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
      >
        The Forum
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 font-dm-sans text-[13px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean",
                active
                  ? "bg-forum-turquoise/40 text-black"
                  : "text-forum-dark-gray hover:bg-forum-turquoise/20 hover:text-black",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/events/create"
          className="hidden items-center gap-1 rounded-md px-2.5 py-1.5 font-dm-sans text-[13px] font-medium text-forum-cerulean transition-colors hover:bg-forum-turquoise/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean sm:flex"
        >
          <Plus size={14} aria-hidden />
          New event
        </Link>
        <NotificationDropdown />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex size-8 items-center justify-center rounded-full bg-forum-cerulean font-dm-sans text-[13px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean focus-visible:ring-offset-2"
            >
              <span aria-hidden>{initial}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 font-dm-sans">
            {name && (
              <>
                <DropdownMenuLabel className="flex flex-col">
                  <span className="truncate text-[13px] font-bold text-black">{name}</span>
                  {netId && netId !== name && (
                    <span className="truncate text-[11px] font-normal text-forum-light-gray">
                      @{netId}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings aria-hidden />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/privacy">
                <Shield aria-hidden />
                Privacy
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/terms">
                <FileText aria-hidden />
                Terms of Use
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
              <LogOut aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
