"use client";

import { usePathname } from "next/navigation";
import { GeometricBackground } from "~/components/layout/geometric-background";
import { Sidebar } from "~/components/layout/sidebar";
import { TopBar } from "~/components/layout/top-bar";

/**
 * Routes whose content fills the shell edge-to-edge and manages its own
 * scrolling — the map canvas, which must not sit in a scroll container.
 *
 * These still get the Sidebar and TopBar; only the `<main>` box changes.
 */
const EDGE_TO_EDGE_ROUTES = new Set(["/map"]);

/**
 * The app shell: docked nav rail, top bar, and page content.
 *
 * This must be a client component driven by `usePathname()`. An earlier version
 * branched inside the server layout on an `x-pathname` request header, but a
 * shared layout is not re-executed on client-side navigation — so soft
 * navigating kept the stale branch and rendered two navs at once.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEdgeToEdge = EDGE_TO_EDGE_ROUTES.has(pathname);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-white">
      <GeometricBackground />
      <div className="relative z-10 flex h-full w-full">
        <Sidebar />
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute top-0 right-0 z-20">
            <TopBar />
          </div>
          {/*
            Edge-to-edge pages get a positioning context with no scroll of their
            own; ordinary pages scroll vertically inside the shell.
          */}
          <main
            className={
              isEdgeToEdge ? "relative h-full overflow-hidden p-3 pl-0" : "h-full overflow-y-auto"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
