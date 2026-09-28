"use client";

import { FileText, LogOut, Plus, Settings, Shield } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { NotificationDropdown } from "~/components/layout/notification-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/**
 * Top utility bar: the wordmark (phones only — the floating sidebar carries
 * navigation on larger screens), New event, notifications and the account
 * menu. Log out is also in the account menu so phones, which have no sidebar,
 * can reach it.
 */
export function AppHeader() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.netId ?? "";
  const netId = session?.user?.netId;
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-4 px-4 sm:px-6">
      <Link
        href="/explore"
        className="shrink-0 rounded font-serif text-[22px] italic md:hidden leading-none tracking-tight text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
      >
        The Forum
      </Link>

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
              className="flex size-9 items-center justify-center rounded-full bg-forum-cerulean font-dm-sans text-[14px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean focus-visible:ring-offset-2"
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
            {/* Desktop has Log out in the sidebar; phones get it here. */}
            <DropdownMenuSeparator className="md:hidden" />
            <DropdownMenuItem
              className="md:hidden"
              onSelect={() => signOut({ redirectTo: "/api/auth/cas/logout" })}
            >
              <LogOut aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
