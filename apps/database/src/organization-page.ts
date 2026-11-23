import { type SQL, and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { type Database, db } from "./db";
import { organizations } from "./schema";

export const ORGANIZATION_PAGE_SIZE = 10;
export type OrganizationSort = "name" | "members" | "newest";
export interface OrganizationQuery {
  search?: string;
  category?: typeof organizations.$inferSelect.category;
  sort?: OrganizationSort;
  order?: "asc" | "desc";
  cursor?: OrganizationCursor;
}

export interface OrganizationCursor {
  direction: "next" | "previous";
  id: string;
  value: string | number;
}
// Below the minimum int4 value: unknown counts come after every known count.
// Keep this expression identical to the schema's expression index.
const members = sql<number>`coalesce(${organizations.memberCount}, '-2147483649'::bigint)`.mapWith(
  Number,
);

export async function loadOrganizationPage(
  query: OrganizationQuery = {},
  database: Pick<Database, "select"> = db,
) {
  const sort = query.sort ?? "name";
  const sortOrder = query.order ?? (sort === "name" ? "asc" : "desc");
  const ascending = sortOrder === "asc";
  const key =
    sort === "name" ? organizations.name : sort === "members" ? members : organizations.createdAt;

  const filters: (SQL | undefined)[] = [];
  if (query.search) {
    const pattern = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(organizations.name, pattern), ilike(organizations.description, pattern)));
  }
  if (query.category) filters.push(eq(organizations.category, query.category));
  const base = and(...filters);
  const requested = query.cursor;
  let valid = Boolean(
    requested &&
      ["next", "previous"].includes(requested.direction) &&
      typeof requested.id === "string" &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requested.id),
  );
  if (valid && requested) {
    if (sort === "members") {
      valid =
        typeof requested.value === "number" &&
        Number.isInteger(requested.value) &&
        requested.value >= -2147483649 &&
        requested.value <= 2147483647;
    } else {
      valid = typeof requested.value === "string" && requested.value.length <= 255;
      if (valid && sort === "newest") {
        const value = String(requested.value).replace("T", " ");
        const date = new Date(`${value.replace(" ", "T")}Z`);
        valid =
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value) &&
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 19) === value.replace(" ", "T").slice(0, 19) &&
          !value.startsWith("0000");
      }
    }
  }
  const cursor = valid && requested ? requested : null;
  const reverse = cursor?.direction === "previous";
  const order = ascending !== reverse ? asc : desc;

  function boundary(value: string | number, id: string, direction: "next" | "previous") {
    const greater = ascending === (direction === "next");
    const operator = greater ? sql`>` : sql`<`;
    const parameter = sort === "newest" ? sql`${value}::timestamp` : sql`${value}`;
    return sql`(${key}, ${organizations.id}) ${operator} (${parameter}, ${id}::uuid)`;
  }

  const [rows, [count]] = await Promise.all([
    database
      .select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        logoUrl: organizations.logoUrl,
        category: organizations.category,
        memberCount: organizations.memberCount,
        // Do not round Postgres microseconds through a JavaScript Date cursor.
        createdAt: sql<string>`${organizations.createdAt}::text`,
        memberKey: members,
      })
      .from(organizations)
      .where(and(base, cursor ? boundary(cursor.value, cursor.id, cursor.direction) : undefined))
      .orderBy(
        sort === "name"
          ? order(key)
          : sql`${key} ${ascending !== reverse ? sql`asc nulls first` : sql`desc nulls last`}`,
        sort === "name"
          ? order(organizations.id)
          : sql`${organizations.id} ${ascending !== reverse ? sql`asc nulls first` : sql`desc nulls last`}`,
      )
      .limit(ORGANIZATION_PAGE_SIZE),
    database.select({ total: sql<number>`count(*)::int` }).from(organizations).where(base),
  ]);
  const items = rows.slice(0, ORGANIZATION_PAGE_SIZE);
  if (reverse) items.reverse();
  type Row = (typeof items)[number];
  const cursorValue = (row: Row) =>
    sort === "name" ? row.name : sort === "members" ? row.memberKey : row.createdAt;
  const cursorFor = (row: Row, direction: OrganizationCursor["direction"]): OrganizationCursor => ({
    id: row.id,
    value: cursorValue(row),
    direction,
  });

  const first = items[0];
  const last = items.at(-1);
  // Check both edges against live data, including when the cursor's row was deleted.
  const [before, after] = await Promise.all([
    first
      ? database
          .select({ count: sql<number>`count(*)::int` })
          .from(organizations)
          .where(and(base, boundary(cursorValue(first), first.id, "previous")))
      : [],
    last
      ? database
          .select({ id: organizations.id })
          .from(organizations)
          .where(and(base, boundary(cursorValue(last), last.id, "next")))
          .limit(1)
      : [],
  ]);
  return {
    items: items.map(({ memberKey: _, createdAt: __, ...item }) => item),
    total: count.total,
    rangeStart: first ? (before[0]?.count ?? 0) + 1 : 0,
    rangeEnd: first ? (before[0]?.count ?? 0) + items.length : 0,
    previousCursor: first && (before[0]?.count ?? 0) > 0 ? cursorFor(first, "previous") : null,
    nextCursor: last && after.length ? cursorFor(last, "next") : null,
    // Allows a stale link beyond the remaining results to recover without a dead end.
    hasCursor: cursor !== null,
  };
}
