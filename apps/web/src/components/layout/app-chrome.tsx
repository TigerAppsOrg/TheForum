"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AmbientBackground } from "~/components/layout/ambient-background";
import { AppHeader } from "~/components/layout/app-header";
import { FloatingSidebar } from "~/components/layout/floating-sidebar";
import { MobileNav } from "~/components/layout/mobile-nav";
import { NAV_ITEMS } from "~/components/layout/nav-items";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

/**
 * Routes whose content fills the shell edge-to-edge and manages its own
 * scrolling — the map canvas, which must not sit in a scroll container.
 */
const EDGE_TO_EDGE_ROUTES = new Set(["/map"]);

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** "g" then a letter jumps between sections (g h Home, g e My Events, …). */
function useGoShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let armedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "g") {
        armedAt = Date.now();
        return;
      }
      if (Date.now() - armedAt > 1200) return;
      armedAt = 0;
      const item = NAV_ITEMS.find((i) => i.shortcut === key);
      if (item) {
        e.preventDefault();
        router.push(item.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}

/**
 * The app shell: the floating sidebar (md+), a utility bar, and the page over a
 * faint pastel background. Phones swap the sidebar for a bottom tab bar.
 *
 * A client component driven by `usePathname()`, because a shared server
 * layout isn't re-executed on client-side navigation.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEdgeToEdge = EDGE_TO_EDGE_ROUTES.has(pathname);
  useGoShortcuts();

  return (
    <TooltipProvider delayDuration={200}>
      {/* `h-dvh`, not `h-screen`: mobile Safari's 100vh includes the URL bar. */}
      <div className="relative isolate flex h-dvh w-full bg-forum-bg">
        <AmbientBackground />
        <FloatingSidebar />
        {/* Clears the 76px sidebar + its 16px inset + breathing room. */}
        <div className="flex min-w-0 flex-1 flex-col md:pl-[108px]">
          <main
            className={cn(
              "relative flex min-h-0 flex-1 flex-col",
              isEdgeToEdge ? "mb-16 overflow-hidden md:mb-0" : "overflow-y-auto pb-16 md:pb-0",
            )}
          >
            <AppHeader />
            <div className="relative min-h-0 flex-1">{children}</div>
          </main>
        </div>
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
