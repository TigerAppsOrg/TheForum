"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "~/components/layout/app-header";
import { MobileNav } from "~/components/layout/mobile-nav";
import { cn } from "~/lib/utils";

/**
 * Routes whose content fills the shell edge-to-edge and manages its own
 * scrolling — the map canvas, which must not sit in a scroll container.
 */
const EDGE_TO_EDGE_ROUTES = new Set(["/map"]);

/**
 * The app shell: a compact header, then the page. Deliberately plain — no
 * decorative background shapes behind content, no floating rail to pad around.
 *
 * A client component driven by `usePathname()`, because a shared server
 * layout isn't re-executed on client-side navigation.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEdgeToEdge = EDGE_TO_EDGE_ROUTES.has(pathname);

  return (
    // `h-dvh`, not `h-screen`: on mobile Safari 100vh includes the area under
    // the URL bar, which pushed the bottom tab bar off-screen.
    <div className="flex h-dvh w-full flex-col bg-white">
      <AppHeader />
      {/* `pb-16` on phones reserves room for the fixed bottom tab bar. */}
      <main
        className={cn(
          "relative min-h-0 flex-1",
          isEdgeToEdge ? "mb-16 overflow-hidden md:mb-0" : "overflow-y-auto pb-16 md:pb-0",
        )}
      >
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
