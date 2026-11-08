/** Run against a migrated local database with ORG_TEST_DATABASE_URL=postgres://… bun test. */
import { beforeAll, describe, expect, test } from "bun:test";
import { asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "./db";
import type { OrganizationCursor, OrganizationQuery, OrganizationSort } from "./organization-page";
import { organizations } from "./schema";

const url = process.env.ORG_TEST_DATABASE_URL;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
let db: Database;
let loadPage: typeof import("./organization-page").loadOrganizationPage;

describe.skipIf(!url)("organization keyset pagination (Postgres)", () => {
  beforeAll(async () => {
    const target = new URL(url as string);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
      throw new Error("Pagination tests require a local database");
    }
    process.env.DATABASE_URL = url;
    db = (await import("./db")).db;
    loadPage = (await import("./organization-page")).loadOrganizationPage;
  });

  // Each test owns temporary rows inside a transaction that always rolls back.
  async function withFixtures(run: (tx: Transaction, search: string) => Promise<void>) {
    const rollback = new Error("rollback test fixtures");
    try {
      await db.transaction(async (tx) => {
        const search = `pagination-test-${crypto.randomUUID()}`;
        await tx.insert(organizations).values(
          Array.from({ length: 47 }, (_, i) => ({
            name: `${search} ${String(i).padStart(3, "0")}`,
            category: i % 2 ? ("academics" as const) : ("culture" as const),
            source: "seed",
            memberCount: [100, 0, null, -2147483648][i % 4],
            // Both tied timestamps and distinct microseconds within one JS millisecond.
            createdAt: sql`timestamp '2026-11-08 10:00:00' + ${i % 23} * interval '1 microsecond'`,
          })),
        );
        await run(tx, search);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  const combinations = (["name", "members", "newest"] satisfies OrganizationSort[]).flatMap(
    (sort) => (["asc", "desc"] as const).map((direction) => ({ sort, direction })),
  );
  for (const { sort, direction } of combinations) {
    test(`${sort} ${direction}: all rows exactly once, ranges, and previous round trip`, async () => {
      await withFixtures(async (tx, search) => {
        const order =
          sort === "name"
            ? [asc(organizations.name), asc(organizations.id)]
            : sort === "members"
              ? [
                  sql`coalesce(${organizations.memberCount}, '-2147483649'::bigint) desc nulls last`,
                  desc(organizations.id),
                ]
              : [desc(organizations.createdAt), desc(organizations.id)];
        const expected = await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(ilike(organizations.name, `%${search}%`))
          .orderBy(...order);
        if ((sort === "name") !== (direction === "asc")) expected.reverse();
        const pages: Awaited<ReturnType<typeof loadPage>>[] = [];
        let cursor: OrganizationCursor | undefined;
        do {
          const page = await loadPage({ search, sort, order: direction, cursor }, tx);
          expect(page.total).toBe(47);
          expect(page.items.length).toBeLessThanOrEqual(10);
          pages.push(page);
          cursor = page.nextCursor ?? undefined;
          if (pages.length > 5) throw new Error("Pagination did not terminate");
        } while (cursor);
        expect(pages.map((page) => page.items.length)).toEqual([10, 10, 10, 10, 7]);
        expect(pages.map((page) => [page.rangeStart, page.rangeEnd])).toEqual([
          [1, 10],
          [11, 20],
          [21, 30],
          [31, 40],
          [41, 47],
        ]);
        expect(pages.flatMap((page) => page.items.map((org) => org.id))).toEqual(
          expected.map((org) => org.id),
        );
        expect(pages[0].previousCursor).toBeNull();
        for (let i = pages.length - 1; i > 0; i--) {
          const previous = await loadPage(
            {
              search,
              sort,
              order: direction,
              cursor: pages[i].previousCursor as OrganizationCursor,
            },
            tx,
          );
          expect(previous.items.map((org) => org.id)).toEqual(
            pages[i - 1].items.map((org) => org.id),
          );
          expect([previous.rangeStart, previous.rangeEnd]).toEqual([
            pages[i - 1].rangeStart,
            pages[i - 1].rangeEnd,
          ]);
        }
        if (sort === "members" && direction === "desc") {
          const counts = pages.flatMap((page) => page.items.map((org) => org.memberCount));
          const firstUnknown = counts.indexOf(null);
          expect(firstUnknown).toBeGreaterThan(0);
          expect(counts.slice(firstUnknown).every((count) => count === null)).toBe(true);
        }
      });
    });
  }

  test("category/search remain applied; filter changes without a boundary start at page one", async () => {
    await withFixtures(async (tx, search) => {
      const first = await loadPage({ search, category: "culture" }, tx);
      const next = await loadPage(
        { search, category: "culture", cursor: first.nextCursor as OrganizationCursor },
        tx,
      );
      expect(first.total).toBe(24);
      expect(next.items).toHaveLength(9);
      expect([...first.items, ...next.items].every((org) => org.category === "culture")).toBe(true);
      for (const changed of [
        { search, category: "academics" },
        { search, category: "culture", sort: "members" },
        { search, category: "culture", order: "desc" },
        { search: `${search} 00`, category: "culture" },
      ] satisfies OrganizationQuery[]) {
        const reset = await loadPage(changed, tx);
        const expected = await loadPage(changed, tx);
        expect(reset).toEqual(expected);
        expect(reset.hasCursor).toBe(false);
      }
    });
  });

  test("malformed cursors, empty results, single page, and literal search wildcards", async () => {
    await withFixtures(async (tx, search) => {
      const first = await loadPage({ search }, tx);
      for (const cursor of [
        { id: "invalid", direction: "next" },
        { id: "00000000-0000-0000-0000-000000000000", direction: "next" },
        { id: first.items[0].id, direction: "invalid" },
      ]) {
        expect(await loadPage({ search, cursor: cursor as OrganizationCursor }, tx)).toEqual(first);
      }
      const single = await loadPage({ search: `${search} 000` }, tx);
      expect(single.items).toHaveLength(1);
      expect(single.previousCursor).toBeNull();
      expect(single.nextCursor).toBeNull();
      for (const suffix of [" missing", "%", "_", "\\"]) {
        const empty = await loadPage({ search: search + suffix }, tx);
        expect(empty.items).toHaveLength(0);
        expect(empty.total).toBe(0);
      }
    });
  });

  test("deleting the boundary row preserves the next page", async () => {
    await withFixtures(async (tx, search) => {
      const first = await loadPage({ search, sort: "newest" }, tx);
      const expected = await loadPage(
        { search, sort: "newest", cursor: first.nextCursor as OrganizationCursor },
        tx,
      );
      await tx.delete(organizations).where(eq(organizations.id, first.items[14].id));
      const next = await loadPage(
        { search, sort: "newest", cursor: first.nextCursor as OrganizationCursor },
        tx,
      );
      expect(next.items).toEqual(expected.items);
      expect(next.total).toBe(46);
    });
  });

  test("inserting ahead of the cursor does not shift or duplicate the next page", async () => {
    await withFixtures(async (tx, search) => {
      const first = await loadPage({ search }, tx);
      const expected = await loadPage(
        { search, cursor: first.nextCursor as OrganizationCursor },
        tx,
      );
      await tx.insert(organizations).values({ name: `${search} ! new`, category: "culture" });
      const next = await loadPage({ search, cursor: first.nextCursor as OrganizationCursor }, tx);
      expect(next.items).toEqual(expected.items);
      expect(next.total).toBe(48);
    });
  });

  test("all six ordering indexes exist on public.organizations", async () => {
    const indexes = await db.execute(sql`select indexname from pg_indexes
      where schemaname = 'public' and tablename = 'organizations'`);
    const names = indexes.map((row) => row.indexname);
    for (const suffix of [
      "name_id",
      "members_id",
      "created_at_id",
      "category_name_id",
      "category_members_id",
      "category_created_at_id",
    ]) {
      expect(names).toContain(`organizations_${suffix}_idx`);
    }
  });

  test("all sorts can seek through their matching index without a Sort node", async () => {
    await db.transaction(async (tx) => {
      // Small test databases may prefer a sequential scan; check index eligibility.
      await tx.execute(sql`set local enable_seqscan = off`);
      await tx.execute(sql`set local enable_bitmapscan = off`);
      for (const filtered of [false, true]) {
        for (const sort of ["name", "members", "newest"]) {
          const key =
            sort === "name"
              ? sql`name`
              : sort === "members"
                ? sql`coalesce(member_count, '-2147483649'::bigint)`
                : sql`created_at`;
          const value =
            sort === "name" ? sql`'M'` : sort === "members" ? sql`0` : sql`timestamp '2026-11-08'`;
          const direction = sort === "name" ? sql`>` : sql`<`;
          const order = sort === "name" ? sql`asc` : sql`desc nulls last`;
          const rows = await tx.execute(sql`explain (format json)
            select id, name from public.organizations
            where ${filtered ? sql`category = 'culture' and` : sql``}
              (${key}, id) ${direction} (${value}, '00000000-0000-0000-0000-000000000000'::uuid)
            order by ${key} ${order}, id ${order} limit 10`);
          const plan = JSON.stringify(rows[0]["QUERY PLAN"]);
          const suffix = sort === "newest" ? "created_at" : sort;
          // With few matching rows Postgres may prefer the unfiltered ordering
          // index and apply category as a filter. Both avoid sorting the result.
          expect(plan).toMatch(
            new RegExp(`organizations_${filtered ? "(?:category_)?" : ""}${suffix}_id_idx`),
          );
          expect(plan).toContain("Index Cond");
          expect(plan).not.toContain('"Node Type":"Sort"');
        }
      }
    });
  });
});
