import { orgCategoryEnum } from "@the-forum/database";
import type { Metadata } from "next";
import { type OrgCursor, getBlockedOrgs, getOrgs, getRecommendedOrgs } from "~/actions/orgs";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { idSchema } from "~/lib/validation";
import { OrgsClient } from "./orgs-client";

export const metadata: Metadata = { title: "Organizations" };

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const search = single("search").trim().slice(0, 100);
  const categoryValue = single("category");
  const category = orgCategoryEnum.enumValues.find((value) => value === categoryValue) ?? "";
  const sort =
    single("sort") === "members" ? "members" : single("sort") === "newest" ? "newest" : "name";
  const afterId = single("after_id");
  const direction = single("direction");
  const valueParam =
    sort === "name" ? "after_name" : sort === "members" ? "after_member_count" : "after_created_at";
  const rawValue = single(valueParam);
  const value = sort === "members" ? Number(rawValue) : rawValue;
  const cursor: OrgCursor | undefined =
    idSchema.safeParse(afterId).success &&
    typeof params[valueParam] === "string" &&
    (typeof value !== "number" || Number.isFinite(value)) &&
    (direction === "next" || direction === "previous")
      ? { id: afterId, direction, value }
      : undefined;
  const order =
    single("order") === "asc"
      ? "asc"
      : single("order") === "desc"
        ? "desc"
        : sort === "name"
          ? "asc"
          : "desc";
  const view = single("view");
  const [orgs, recommended, hidden] = await Promise.all([
    getOrgs({ search, category, sort, order, cursor }),
    getRecommendedOrgs(),
    getBlockedOrgs(),
  ]);

  return (
    <PageShell>
      <PageHeading>Organizations</PageHeading>
      <OrgsClient
        initialOrgs={orgs}
        initialSearch={search}
        initialCategory={category}
        initialSort={sort}
        initialOrder={order}
        recommendedOrgs={recommended}
        initialHidden={hidden}
        showHidden={view === "hidden"}
      />
    </PageShell>
  );
}
