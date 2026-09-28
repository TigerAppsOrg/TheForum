import type { Metadata } from "next";

/*
 * Metadata lives in a layout rather than explore/page.tsx so this doesn't
 * collide with the feed/pagination work in that file.
 */
export const metadata: Metadata = { title: "Explore" };

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
