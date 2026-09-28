import type { Metadata } from "next";

// The page is a client component, so its title is declared here.
export const metadata: Metadata = { title: "Create an Organization" };

export default function CreateOrgLayout({ children }: { children: React.ReactNode }) {
  return children;
}
