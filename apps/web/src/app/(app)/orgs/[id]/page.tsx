import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getOrg } from "~/actions/orgs";
import { getOrgEmails, tigerInboxOrgUrl } from "~/lib/inbox-engine";
import { OrgProfileClient } from "./org-profile-client";

// Deduped per request so the title and the page share one query.
const loadOrg = cache(getOrg);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const org = await loadOrg(id).catch(() => null);
  return { title: org?.name ?? "Organization" };
}

export default async function OrgProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await loadOrg(id);

  if (!org) notFound();

  // MyPrincetonU groups have their listserv emails in InboxEngine. Best-effort:
  // an unreachable engine just means no emails section.
  const emails = org.externalId ? await getOrgEmails(org.externalId) : null;

  return (
    <OrgProfileClient
      org={org}
      emails={emails}
      emailsBrowseUrl={org.externalId ? tigerInboxOrgUrl(org.externalId) : null}
    />
  );
}
