"use client";

import { FileText, LogOut, Settings, Shield } from "lucide-react";
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
 * Notification bell + account menu.
 *
 * Log Out lives in the account menu rather than as a primary nav tab, where it
 * sat one mis-tap away from Orgs on the phone tab bar.
 */
export function TopBar() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.netId ?? "";
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <header className="flex items-center justify-end gap-4 px-6 py-3 flex-shrink-0">
      <div className="flex items-center gap-3">
        <NotificationDropdown />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex size-10 items-center justify-center rounded-full bg-forum-cerulean text-[14px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean focus-visible:ring-offset-2"
            >
              <span aria-hidden>{initial}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 font-dm-sans">
            {(name || session?.user?.netId) && (
              <>
                <DropdownMenuLabel className="flex flex-col">
                  <span className="truncate text-[13px] font-bold text-black">{name}</span>
                  {session?.user?.netId && session.user.netId !== name && (
                    <span className="truncate text-[11px] font-normal text-forum-light-gray">
                      @{session.user.netId}
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
