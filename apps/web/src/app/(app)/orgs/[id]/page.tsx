import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getOrg } from "~/actions/orgs";
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

  return <OrgProfileClient org={org} />;
}
