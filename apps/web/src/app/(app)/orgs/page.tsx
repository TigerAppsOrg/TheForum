import { getOrgs, getRecommendedOrgs } from "~/actions/orgs";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { OrgsClient } from "./orgs-client";

export default async function OrgsPage() {
  const [orgs, recommended] = await Promise.all([getOrgs(), getRecommendedOrgs()]);

  return (
    <PageShell>
      <PageHeading>Organizations</PageHeading>
      <OrgsClient initialOrgs={orgs} recommendedOrgs={recommended} />
    </PageShell>
  );
}
