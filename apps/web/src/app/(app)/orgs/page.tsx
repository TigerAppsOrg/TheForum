import type { Metadata } from "next";
import { getBlockedOrgs, getOrgs, getRecommendedOrgs } from "~/actions/orgs";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { OrgsClient } from "./orgs-client";

export const metadata: Metadata = { title: "Organizations" };

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const [orgs, recommended, hidden] = await Promise.all([
    getOrgs(),
    getRecommendedOrgs(),
    getBlockedOrgs(),
  ]);

  return (
    <PageShell>
      <PageHeading>Organizations</PageHeading>
      <OrgsClient
        initialOrgs={orgs}
        recommendedOrgs={recommended}
        initialHidden={hidden}
        showHidden={view === "hidden"}
      />
    </PageShell>
  );
}
