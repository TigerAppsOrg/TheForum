/** Only a migrated, disposable recommendation database; no upstream requests. */
import { beforeAll, expect, test } from "bun:test";
import type { EngineEvent } from "../../../packages/inbox-engine/src/client";

const url = process.env.FEED_RECOMMENDATIONS_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.slice(1).startsWith("forum_recommendations_test")) {
  throw new Error("Sync tests require a disposable forum_recommendations_test database");
}
if (url) process.env.DATABASE_URL = url;
let m: typeof import("./index");
beforeAll(async () => {
  if (url) m = await import("./index");
});

test.skipIf(!url)(
  "expiration preserves history without importing old events or restoring drafts",
  async () => {
    const { syncEvents, syncLocations } = await import("./sync-inbox-engine");
    const prefix = crypto.randomUUID();
    const now = Date.now();
    const fixture = (id: string, days: number): EngineEvent => ({
      id: `${prefix}-${id}`,
      status: "active",
      title: id,
      summary: "Lifecycle fixture",
      startsAt: new Date(now + days * 86400_000).toISOString(),
      endsAt: null,
      timePrecision: "exact",
      location: {
        text: "TBA",
        id: null,
        name: null,
        latitude: null,
        longitude: null,
        room: null,
        online: false,
      },
      tags: ["visual arts"],
      freeFood: false,
      rsvpUrl: null,
      host: null,
      confidence: 1,
      publishable: true,
      extractionVersion: "fixture",
      imageUrl: null,
      announcements: { emails: 0, listservs: [], firstAnnouncedAt: null },
      series: null,
      duplicateOf: null,
      source: {
        kind: "listserv",
        messageId: null,
        subject: null,
        sender: null,
        sentAt: null,
        listservs: [],
        url: null,
        archiveUrl: null,
      },
      updatedAt: new Date(now - 1000).toISOString(),
      revision: 1,
    });
    const active = fixture("attended", 1);
    const old = fixture("never-imported", -2);
    const series = [1, 2, 3].map((days) => ({
      ...fixture(`series-${days}`, days),
      series: { id: prefix, size: 3 },
    }));
    const upstream = [active, old, ...series];
    const client = {
      locations: async () => ({ locations: [] }),
      eventChanges: async (cursor: number) => ({ changes: cursor === 0 ? upstream : [], next: 1 }),
    } as unknown as Parameters<typeof syncEvents>[0];
    const keys = upstream.map((event) => `ie:${event.id}`);
    const read = async (event: EngineEvent) => {
      const [row] = await m.db
        .select()
        .from(m.events)
        .where(m.eq(m.events.sourceMessageId, `ie:${event.id}`));
      return row;
    };
    try {
      await syncLocations(client);
      await syncEvents(client);
      const initial = await read(active);
      if (!initial) throw new Error("Missing imported fixture");
      expect(initial.status).toBe("published");
      expect(await read(old)).toBeUndefined();
      expect((await read(series[0] as EngineEvent))?.status).toBe("published");
      expect((await read(series[1] as EngineEvent))?.status).toBe("published");
      expect(await read(series[2] as EngineEvent)).toBeUndefined();
      // Saves and RSVPs must survive the lifecycle transition on the same event ID.
      await m.db.insert(m.savedEvents).values({ userId: initial.creatorId, eventId: initial.id });
      await m.db.insert(m.rsvps).values({ userId: initial.creatorId, eventId: initial.id });
      active.startsAt = old.startsAt;
      active.series = { id: "ended-series", size: 3 };
      active.updatedAt = new Date().toISOString();
      await syncEvents(client);
      expect((await read(active))?.status).toBe("published");
      expect((await read(active))?.id).toBe(initial.id);
      expect(
        await m.db.select().from(m.savedEvents).where(m.eq(m.savedEvents.eventId, initial.id)),
      ).toHaveLength(1);
      expect(
        await m.db.select().from(m.rsvps).where(m.eq(m.rsvps.eventId, initial.id)),
      ).toHaveLength(1);
      expect(
        await m.db.select().from(m.eventTags).where(m.eq(m.eventTags.eventId, initial.id)),
      ).toHaveLength(1);
      const retained = await read(active);
      await syncEvents(client);
      expect(await read(active)).toEqual(retained);
      // Status and quality take precedence over preserving ended history.
      for (const status of ["withdrawn", "duplicate", "active"] as const) {
        await m.db
          .update(m.events)
          .set({ status: "published", isPublic: true })
          .where(m.eq(m.events.id, initial.id));
        active.status = status;
        active.publishable = status !== "active";
        await syncEvents(client);
        expect((await read(active))?.status).toBe("draft");
        expect((await read(active))?.isPublic).toBe(false);
      }
      active.status = "active";
      active.publishable = true;
      await syncEvents(client);
      expect((await read(active))?.status).toBe("draft");
      expect(await read(old)).toBeUndefined();
    } finally {
      await m.db.delete(m.events).where(m.inArray(m.events.sourceMessageId, keys));
    }
  },
);
