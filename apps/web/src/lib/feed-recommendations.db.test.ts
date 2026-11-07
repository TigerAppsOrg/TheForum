/** Isolated fixtures only: see docs/ranking.md for the disposable database requirement. */
import { afterAll, beforeAll, expect, test } from "bun:test";

const url = process.env.FEED_RECOMMENDATIONS_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.slice(1).startsWith("forum_recommendations_test")) {
  throw new Error("Recommendation tests require a disposable forum_recommendations_test database");
}
if (url) process.env.DATABASE_URL = url;

let m: typeof import("@the-forum/database");
let load: typeof import("./feed").loadRankedFeed;
let userId = "";
let locationId = "";
let neutralLocationId = "";
let historyId = "";
let highId = "";
let lowId = "";
let placeId = "";
let futureSaveId = "";
const ids: string[] = [];
const now = new Date();
const before = new Date(now.getTime() - 60_000);
const starts = new Date(now.getTime() + 3 * 86400_000);
const vector = (axis: number) => Array.from({ length: 1536 }, (_, i) => (i === axis ? 1 : 0));

beforeAll(async () => {
  if (!url) return;
  m = await import("@the-forum/database");
  load = (await import("./feed")).loadRankedFeed;
  const [user] = await m.db
    .insert(m.users)
    .values({
      netId: `_rec_${crypto.randomUUID()}`,
      email: `${crypto.randomUUID()}@example.test`,
      displayName: "Recommendation fixture",
    })
    .returning();
  if (!user) throw new Error("No fixture user");
  userId = user.id;
  locationId = `recommendations-${crypto.randomUUID()}`;
  await m.db.insert(m.campusLocations).values({
    id: locationId,
    name: "Frist Campus Center",
    latitude: 40.3469,
    longitude: -74.6551,
    category: "social",
    area: null,
  });
  neutralLocationId = `neutral-${crypto.randomUUID()}`;
  await m.db.insert(m.campusLocations).values({
    id: neutralLocationId,
    name: "Unknown",
    latitude: 0,
    longitude: 0,
    category: "other",
  });
  const { setupRecommendations } = await import("../../../database/src/setup-recommendations");
  const preview = await setupRecommendations({ dryRun: true });
  expect(preview.areaChanges).toContainEqual({
    id: locationId,
    name: "Frist Campus Center",
    oldArea: null,
    newArea: "central",
  });
  const [beforeSetup] = await m.db
    .select()
    .from(m.campusLocations)
    .where(m.eq(m.campusLocations.id, locationId));
  expect(beforeSetup?.area).toBeNull();
  const firstSetup = await setupRecommendations();
  expect(firstSetup.embeddings).toBe(m.eventTagEnum.enumValues.length);
  expect(await setupRecommendations()).toEqual(firstSetup);
  const [mapped] = await m.db
    .select()
    .from(m.campusLocations)
    .where(m.eq(m.campusLocations.id, locationId));
  expect(mapped?.area).toBe("central");
  const [neutral] = await m.db
    .select()
    .from(m.campusLocations)
    .where(m.eq(m.campusLocations.id, neutralLocationId));
  expect(neutral?.area).toBeNull();
  const rows = await m.db
    .insert(m.events)
    .values(
      [
        { title: "History", datetime: before },
        { title: "High similarity", datetime: starts },
        { title: "Low similarity", datetime: starts },
        { title: "Preferred place", datetime: starts, locationId },
        { title: "Future save", datetime: before },
      ].map((e) => ({
        description: "Fixture",
        locationId: neutralLocationId,
        ...e,
        creatorId: userId,
        status: "published" as const,
        isPublic: true,
        createdAt: before,
      })),
    )
    .returning({ id: m.events.id });
  ids.push(...rows.map((r) => r.id));
  [historyId, highId, lowId, placeId, futureSaveId] = ids as [
    string,
    string,
    string,
    string,
    string,
  ];
  await m.db.insert(m.eventTags).values([
    { eventId: historyId, tag: "visual arts" },
    { eventId: highId, tag: "visual arts" },
    { eventId: lowId, tag: "music" },
    { eventId: futureSaveId, tag: "music" },
  ]);
  // Synthetic orthogonal vectors make the expected ordering unambiguous.
  await m.db
    .insert(m.eventTagEmbeddings)
    .values([
      { tagName: "visual arts", embedding: vector(0) },
      { tagName: "music", embedding: vector(1) },
    ])
    .onConflictDoUpdate({
      target: m.eventTagEmbeddings.tagName,
      set: { embedding: m.sql`excluded.embedding` },
    });
});

afterAll(async () => {
  if (!userId) return;
  if (ids.length) await m.db.delete(m.events).where(m.inArray(m.events.id, ids));
  await m.db.delete(m.campusLocations).where(m.eq(m.campusLocations.id, locationId));
  await m.db.delete(m.campusLocations).where(m.eq(m.campusLocations.id, neutralLocationId));
  await m.db.delete(m.users).where(m.eq(m.users.id, userId));
});

test.skipIf(!url)("cold start, location boosts, semantic profiles and pinned history", async () => {
  const query = { sort: "foryou" as const, limit: 2000, offset: 0, asOf: now };
  const cold = await load(userId, query);
  expect(cold.events.map((e) => e.id)).toContain(highId);
  await m.db.insert(m.userRegions).values({ userId, region: "central" });
  const nearby = await load(userId, query);
  expect(nearby.events[0]?.id).toBe(placeId);
  await m.db.insert(m.savedEvents).values([{ userId, eventId: historyId, createdAt: before }]);
  await m.db.insert(m.rsvps).values({ userId, eventId: historyId, createdAt: before });
  const personalized = await load(userId, query);
  expect(personalized.events[0]?.id).toBe(highId);
  expect(personalized.events.findIndex((e) => e.id === highId)).toBeLessThan(
    personalized.events.findIndex((e) => e.id === lowId),
  );
  // Syncing an ended imported event must preserve its contribution to the profile.
  const { syncEvents } = await import("../../../database/src/sync-inbox-engine");
  const engineId = crypto.randomUUID();
  await m.db
    .update(m.events)
    .set({ sourceMessageId: `ie:${engineId}` })
    .where(m.eq(m.events.id, historyId));
  const ended = new Date(now.getTime() - 86400_000).toISOString();
  const engineEvent = {
    id: engineId,
    status: "active",
    publishable: true,
    startsAt: ended,
    endsAt: ended,
    updatedAt: now.toISOString(),
    announcements: { emails: 0, firstAnnouncedAt: null },
    series: { id: "ended-series", size: 3 },
    title: "History",
    summary: "Fixture",
    location: { id: neutralLocationId },
    host: null,
    source: { kind: "listserv", url: null },
    tags: ["visual arts"],
  };
  const client = {
    eventChanges: async (cursor: number) => ({
      changes: cursor === 0 ? [engineEvent] : [],
      next: 1,
    }),
  } as unknown as Parameters<typeof syncEvents>[0];
  await syncEvents(client);
  expect((await load(userId, query)).events.map((e) => e.id)).toEqual(
    personalized.events.map((e) => e.id),
  );
  expect((await load(userId, query)).events.map((e) => e.id)).not.toContain(historyId);
  // Withdrawals remove that profile signal; legitimate drafts stay excluded.
  engineEvent.status = "withdrawn";
  await syncEvents(client);
  expect((await load(userId, query)).events[0]?.id).toBe(placeId);
  await m.db
    .update(m.events)
    .set({ status: "published", isPublic: true })
    .where(m.eq(m.events.id, historyId));
  await m.db
    .insert(m.savedEvents)
    .values({ userId, eventId: futureSaveId, createdAt: new Date(now.getTime() + 1000) });
  expect((await load(userId, query)).events.map((e) => e.id)).toEqual(
    personalized.events.map((e) => e.id),
  );
  const first = await load(userId, { ...query, limit: 1 });
  const second = await load(userId, {
    ...query,
    limit: 2,
    offset: first.nextOffset,
    asOf: new Date(first.asOf),
  });
  expect([...first.events, ...second.events].map((e) => e.id)).toEqual(
    personalized.events.map((e) => e.id),
  );
  // Missing all embeddings must still produce a complete feed.
  await m.db.delete(m.eventTagEmbeddings);
  expect((await load(userId, query)).events).toHaveLength(3);
  await m.db.insert(m.eventTagEmbeddings).values([
    { tagName: "visual arts", embedding: vector(0) },
    { tagName: "music", embedding: vector(1) },
  ]);
});

test.skipIf(!url)(
  "saturated candidate pool retrieves matching areas and profile tags",
  async () => {
    const fillers = await m.db
      .insert(m.events)
      .values(
        Array.from({ length: 1000 }, (_, i) => ({
          title: `Filler ${i}`,
          description: "Fixture",
          locationId: neutralLocationId,
          creatorId: userId,
          status: "published" as const,
          isPublic: true,
          datetime: new Date(now.getTime() + 86400_000),
          createdAt: before,
        })),
      )
      .returning({ id: m.events.id });
    ids.push(...fillers.map((e) => e.id));
    const ranked = await load(userId, { sort: "foryou", limit: 1500, offset: 0, asOf: now });
    expect(ranked.events.map((e) => e.id)).toContain(highId);
    expect(ranked.events.map((e) => e.id)).toContain(placeId);
    expect(ranked.events.map((e) => e.id)).not.toContain(lowId);
  },
);
