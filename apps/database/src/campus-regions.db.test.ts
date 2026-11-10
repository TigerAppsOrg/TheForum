/** Run only against a migrated disposable recommendation database. */
import { beforeAll, expect, test } from "bun:test";

const url = process.env.FEED_RECOMMENDATIONS_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.slice(1).startsWith("forum_recommendations_test")) {
  throw new Error("Sync tests require a disposable forum_recommendations_test database");
}
if (url) process.env.DATABASE_URL = url;
let m: typeof import("./index");
beforeAll(async () => {
  if (url) m = await import("./index");
});

test.skipIf(!url)("location sync assigns areas on insertion and remaps updates", async () => {
  const { syncLocations } = await import("./sync-inbox-engine");
  const syncId = `sync-${crypto.randomUUID()}`;
  const syncClient = (name: string) =>
    ({
      locations: async () => ({
        locations: [{ id: syncId, name, latitude: 40.347, longitude: -74.657, category: "social" }],
      }),
    }) as unknown as Parameters<typeof syncLocations>[0];
  try {
    await syncLocations(syncClient("Dillon Gym"));
    const [inserted] = await m.db
      .select()
      .from(m.campusLocations)
      .where(m.eq(m.campusLocations.id, syncId));
    expect(inserted?.area).toBe("off-campus");
    await syncLocations(syncClient("Whitman College"));
    const [updated] = await m.db
      .select()
      .from(m.campusLocations)
      .where(m.eq(m.campusLocations.id, syncId));
    expect(updated?.area).toBe("west");
    const [tba] = await m.db
      .select()
      .from(m.campusLocations)
      .where(m.eq(m.campusLocations.id, "tba"));
    expect(tba?.area).toBeNull();
  } finally {
    await m.db.delete(m.campusLocations).where(m.eq(m.campusLocations.id, syncId));
  }
});
