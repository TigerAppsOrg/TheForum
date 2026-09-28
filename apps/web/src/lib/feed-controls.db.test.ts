/**
 * Feed controls against a real database: hidden orgs, the three sorts and
 * stable pagination. Skipped unless FEED_TEST_DATABASE_URL points at a
 * migrated database with upcoming events (e.g. after `db:sync-engine`):
 *
 *   FEED_TEST_DATABASE_URL=postgres://… bun test src/lib/feed-controls.db.test.ts
 *
 * It creates one throwaway user and deletes it (cascading its follows and
 * hides) at the end; event and org rows are only read.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

const url = process.env.FEED_TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const TEST_NET_ID = "_feedcontrols_test";
let userId = "";

// Server actions (the map) read the session from ~/auth; stand in the test user.
if (url) {
  mock.module("~/auth", () => ({
    auth: async () => ({ user: { id: userId } }),
  }));
}

describe.skipIf(!url)("feed controls (database)", () => {
  let dbm: typeof import("@the-forum/database");
  let feed: typeof import("~/lib/feed");
  let prefs: typeof import("~/lib/org-preferences");
  let map: typeof import("~/actions/map");
  /** An org with several upcoming events in the next week, at least one mappable. */
  let orgId = "";

  /** Every event of one sort, paging with `asOf` the way the client does. */
  async function allPages(sort: "foryou" | "soonest" | "recent", limit = 20) {
    const ids: string[] = [];
    let offset = 0;
    let asOf: Date | undefined;
    for (;;) {
      const page = await feed.loadRankedFeed(userId, { sort, limit, offset, asOf });
      ids.push(...page.events.map((e) => e.id));
      asOf = new Date(page.asOf);
      offset = page.nextOffset;
      if (page.remaining === 0) return { ids, total: page.total };
    }
  }

  async function orgEventIds(id: string) {
    const rows = await dbm.db
      .select({ id: dbm.events.id })
      .from(dbm.events)
      .where(dbm.eq(dbm.events.orgId, id));
    return new Set(rows.map((r) => r.id));
  }

  beforeAll(async () => {
    dbm = await import("@the-forum/database");
    feed = await import("~/lib/feed");
    prefs = await import("~/lib/org-preferences");
    map = await import("~/actions/map");

    await dbm.db.delete(dbm.users).where(dbm.eq(dbm.users.netId, TEST_NET_ID));
    const [user] = await dbm.db
      .insert(dbm.users)
      .values({
        netId: TEST_NET_ID,
        email: `${TEST_NET_ID}@princeton.edu`,
        displayName: "Feed Test",
        onboarded: true,
      })
      .returning({ id: dbm.users.id });
    if (!user) throw new Error("could not create test user");
    userId = user.id;

    const [busiest] = await dbm.db
      .select({ orgId: dbm.events.orgId, n: dbm.sql<number>`count(*)::int` })
      .from(dbm.events)
      .innerJoin(dbm.campusLocations, dbm.eq(dbm.events.locationId, dbm.campusLocations.id))
      .where(
        dbm.and(
          dbm.eq(dbm.events.status, "published"),
          dbm.eq(dbm.events.isPublic, true),
          dbm.isNotNull(dbm.events.orgId),
          dbm.gt(dbm.events.datetime, new Date()),
          dbm.lt(dbm.events.datetime, new Date(Date.now() + 6 * 86_400_000)),
          dbm.ne(dbm.campusLocations.latitude, 0),
        ),
      )
      .groupBy(dbm.events.orgId)
      .orderBy(dbm.desc(dbm.sql`count(*)`))
      .limit(1);
    if (!busiest?.orgId) throw new Error("no upcoming org events — sync some data first");
    orgId = busiest.orgId;
  });

  afterAll(async () => {
    if (userId) await dbm.db.delete(dbm.users).where(dbm.eq(dbm.users.id, userId));
  });

  test("pagination: every sort covers the same events, once each", async () => {
    const forYou = await allPages("foryou");
    const soonest = await allPages("soonest");
    const recent = await allPages("recent", 7);
    for (const run of [forYou, soonest, recent]) {
      expect(new Set(run.ids).size).toBe(run.ids.length);
      expect(run.ids.length).toBe(run.total);
    }
    expect(new Set(soonest.ids)).toEqual(new Set(forYou.ids));
    expect(new Set(recent.ids)).toEqual(new Set(forYou.ids));
  });

  test("For you: announced events lead; unannounced MyPrincetonU listings fill in below", async () => {
    const { ids } = await allPages("foryou");
    const rows = await dbm.db
      .select({ id: dbm.events.id, count: dbm.events.announcementCount })
      .from(dbm.events)
      .where(dbm.inArray(dbm.events.id, ids));
    const announced = new Set(rows.filter((r) => r.count > 0).map((r) => r.id));
    const positions = ids.map((id, i) => (announced.has(id) ? i : -1)).filter((i) => i >= 0);
    if (announced.size === 0) return;
    const meanAnnounced = positions.reduce((a, b) => a + b, 0) / positions.length;
    console.log(
      `  announced events: ${announced.size}/${ids.length}; mean position ${meanAnnounced.toFixed(1)}; ` +
        `in top 20: ${positions.filter((p) => p < 20).length}`,
    );
    expect(meanAnnounced).toBeLessThan(ids.length / 4);
  });

  test("Recently posted: ordered by announcement time (else entry time), newest first", async () => {
    const { ids } = await allPages("recent");
    const rows = await dbm.db
      .select({
        id: dbm.events.id,
        announcedAt: dbm.events.announcedAt,
        createdAt: dbm.events.createdAt,
      })
      .from(dbm.events)
      .where(dbm.inArray(dbm.events.id, ids));
    const posted = new Map(rows.map((r) => [r.id, (r.announcedAt ?? r.createdAt).getTime()]));
    for (let i = 1; i < ids.length; i++) {
      expect(posted.get(ids[i] as string) as number).toBeLessThanOrEqual(
        posted.get(ids[i - 1] as string) as number,
      );
    }
  });

  test("hidden org: absent from every sort, search and the map; back after unhiding", async () => {
    const hiddenIds = await orgEventIds(orgId);
    const before = await allPages("soonest");
    const mapBefore = await map.getMapEvents({ days: 7 });
    expect(before.ids.some((id) => hiddenIds.has(id))).toBe(true);
    expect(mapBefore.some((e) => hiddenIds.has(e.id))).toBe(true);

    await prefs.setHidden(userId, orgId);

    for (const sort of ["foryou", "soonest", "recent"] as const) {
      const { ids } = await allPages(sort);
      expect(ids.some((id) => hiddenIds.has(id))).toBe(false);
      expect(ids.length).toBe(
        before.ids.length - before.ids.filter((id) => hiddenIds.has(id)).length,
      );
    }
    const [orgRow] = await dbm.db
      .select({ name: dbm.organizations.name })
      .from(dbm.organizations)
      .where(dbm.eq(dbm.organizations.id, orgId));
    const [anyTitle] = await dbm.db
      .select({ title: dbm.events.title })
      .from(dbm.events)
      .where(dbm.inArray(dbm.events.id, [...hiddenIds]))
      .limit(1);
    const searched = await feed.loadRankedFeed(userId, {
      search: anyTitle?.title.slice(0, 20),
      limit: 50,
      offset: 0,
    });
    expect(searched.events.some((e) => hiddenIds.has(e.id))).toBe(false);
    const mapAfter = await map.getMapEvents({ days: 7 });
    expect(mapAfter.some((e) => hiddenIds.has(e.id))).toBe(false);
    console.log(
      `  hid "${orgRow?.name}": ${hiddenIds.size} events (all dates) hidden; none in any sort, search or the map ` +
        `(map ${mapBefore.length} → ${mapAfter.length})`,
    );

    await prefs.clearHidden(userId, orgId);
    const restored = await allPages("soonest");
    expect(restored.ids).toEqual(before.ids);
  });

  test("hiding mid-scroll: later pages drop the org without shifting anything else", async () => {
    const hiddenIds = await orgEventIds(orgId);
    const full = await allPages("soonest", 10);

    const page1 = await feed.loadRankedFeed(userId, { sort: "soonest", limit: 10, offset: 0 });
    await prefs.setHidden(userId, orgId);
    const rest: string[] = [];
    let offset = page1.nextOffset;
    for (;;) {
      const page = await feed.loadRankedFeed(userId, {
        sort: "soonest",
        limit: 10,
        offset,
        asOf: new Date(page1.asOf),
      });
      rest.push(...page.events.map((e) => e.id));
      offset = page.nextOffset;
      if (page.remaining === 0) break;
    }
    await prefs.clearHidden(userId, orgId);

    const seen = [...page1.events.map((e) => e.id), ...rest];
    const expected = [
      ...full.ids.slice(0, page1.events.length),
      ...full.ids.slice(page1.events.length).filter((id) => !hiddenIds.has(id)),
    ];
    expect(seen).toEqual(expected);
  });

  test("hiding unfollows, and following unhides", async () => {
    await prefs.setFollowing(userId, orgId);
    expect(await prefs.setHidden(userId, orgId)).toEqual({ unfollowed: true });
    expect(await prefs.loadOrgViewerState(userId, orgId)).toEqual({
      following: false,
      hidden: true,
    });
    await prefs.setFollowing(userId, orgId);
    expect(await prefs.loadOrgViewerState(userId, orgId)).toEqual({
      following: true,
      hidden: false,
    });
    // Idempotent both ways.
    await prefs.setFollowing(userId, orgId);
    await prefs.clearFollowing(userId, orgId);
    await prefs.clearFollowing(userId, orgId);
    expect(await prefs.loadOrgViewerState(userId, orgId)).toEqual({
      following: false,
      hidden: false,
    });
  });

  test("following an org raises its events in For you", async () => {
    const orgIds = await orgEventIds(orgId);
    const positions = (ids: string[]) =>
      ids.map((id, i) => (orgIds.has(id) ? i : -1)).filter((i) => i >= 0);

    const before = positions((await allPages("foryou")).ids);
    await prefs.setFollowing(userId, orgId);
    const after = positions((await allPages("foryou")).ids);
    await prefs.clearFollowing(userId, orgId);

    console.log(`  org event positions: before [${before}] → followed [${after}]`);
    expect(after.length).toBe(before.length);
    expect(Math.min(...after)).toBeLessThanOrEqual(Math.min(...before));
    expect(after.reduce((a, b) => a + b, 0)).toBeLessThan(before.reduce((a, b) => a + b, 0));
    // The diversity cap still applies: at most 3 in the first 20.
    expect(after.filter((p) => p < 20).length).toBeLessThanOrEqual(3);
  });
});
