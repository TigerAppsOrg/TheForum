/**
 * Sync The Forum from InboxEngine (packages/inbox-engine), the shared source of truth for
 * Princeton organizations, campus venues and events.
 *
 *   bun run db:sync-engine            # orgs + venues + events (full pass; a few seconds)
 *
 * Env: DATABASE_URL, INBOX_ENGINE_URL, INBOX_ENGINE_TOKEN.
 *
 * - Organizations: every MyPrincetonU group, upserted on `external_id` ("mpu:<id>"). A manual
 *   Forum org with the same name is linked instead of duplicated. Forum-only fields (followers,
 *   members, events) are never touched.
 * - Venues: InboxEngine's campus gazetteer, upserted into campus_locations.
 * - Events: the whole revisioned feed. Official MyPrincetonU events and publishable listserv
 *   extractions become published Forum events owned by the InboxEngine bot user; withdrawn or
 *   duplicate ones are unpublished (never deleted, so RSVPs survive). Recurring series (daily
 *   prayer, weekly office hours) show only their next SERIES_WINDOW occurrences, so each run
 *   re-reads the full feed to advance that window.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  type EngineEvent,
  type EngineOrganization,
  InboxEngineClient,
} from "../../../packages/inbox-engine/src/client/index.ts";
import { db } from "./db";
import {
  events,
  campusLocations,
  eventTagEnum,
  eventTags,
  locationCategoryEnum,
  orgCategoryEnum,
  organizations,
  syncState,
  users,
} from "./schema";

const TBA_LOCATION = { id: "tba", name: "Location TBA", latitude: 0, longitude: 0 } as const;
const BOT = { netId: "_inboxengine", email: "inboxengine@tigerapps.org", displayName: "The Forum" };
const CURSOR_KEY = "inbox-engine:events";
/** Upcoming occurrences shown per recurring series. */
const SERIES_WINDOW = 2;

type OrgCategory = (typeof orgCategoryEnum.enumValues)[number];
type LocationCategory = (typeof locationCategoryEnum.enumValues)[number];
type EventTag = (typeof eventTagEnum.enumValues)[number];

const orgCategories = new Set<string>(orgCategoryEnum.enumValues);
const locationCategories = new Set<string>(locationCategoryEnum.enumValues);
const eventTagValues = new Set<string>(eventTagEnum.enumValues);

function engineClient() {
  const url = process.env.INBOX_ENGINE_URL;
  const token = process.env.INBOX_ENGINE_TOKEN;
  if (!url || !token) throw new Error("INBOX_ENGINE_URL and INBOX_ENGINE_TOKEN are required");
  return new InboxEngineClient(url, token, 60_000);
}

async function botUserId(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.netId, BOT.netId));
  if (existing) return existing.id;
  const [created] = await db
    .insert(users)
    .values({ ...BOT, onboarded: true })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (created) return created.id;
  const [again] = await db.select({ id: users.id }).from(users).where(eq(users.netId, BOT.netId));
  if (!again) throw new Error("Could not create the InboxEngine bot user");
  return again.id;
}

function orgValues(org: EngineOrganization) {
  const category = (
    org.forumCategory && orgCategories.has(org.forumCategory) ? org.forumCategory : "social event"
  ) as OrgCategory;
  return {
    name: org.name.slice(0, 255),
    description: org.description ?? org.tagline ?? null,
    logoUrl: org.logoUrl,
    category,
    source: "myprincetonu",
    externalId: org.id,
    acronym: org.acronym?.slice(0, 40) ?? null,
    tagline: org.tagline,
    groupType: org.groupType?.slice(0, 120) ?? null,
    groupUrl: org.groupUrl,
    website: org.website,
    contactEmail: org.contactEmail?.slice(0, 255) ?? null,
    socials: org.socials ?? {},
    memberCount: org.memberCount ?? null,
    syncedAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function syncOrganizations(client = engineClient()) {
  const { organizations: remote } = await client.organizations("", 5000);
  let created = 0;
  let linked = 0;
  let updated = 0;
  for (const org of remote) {
    if (!org.id.startsWith("mpu:")) continue; // curated non-directory aliases stay engine-only
    const values = orgValues(org);
    const [byExternal] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.externalId, org.id));
    if (byExternal) {
      await db.update(organizations).set(values).where(eq(organizations.id, byExternal.id));
      updated++;
      continue;
    }
    // A Forum-created org with the same name becomes the official record (keeps followers/events).
    const [byName] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.name, values.name), isNull(organizations.externalId)));
    if (byName) {
      await db.update(organizations).set(values).where(eq(organizations.id, byName.id));
      linked++;
      continue;
    }
    await db.insert(organizations).values(values).onConflictDoNothing();
    created++;
  }
  return { remote: remote.length, created, linked, updated };
}

export async function syncLocations(client = engineClient()) {
  const { locations } = await client.locations();
  const rows = [
    ...locations.map((l) => ({
      id: l.id.slice(0, 100),
      name: l.name.slice(0, 255),
      latitude: l.latitude,
      longitude: l.longitude,
      category: (locationCategories.has(l.category) ? l.category : "other") as LocationCategory,
    })),
    { ...TBA_LOCATION, category: "other" as LocationCategory },
  ];
  for (const row of rows)
    await db
      .insert(campusLocations)
      .values(row)
      .onConflictDoUpdate({
        target: campusLocations.id,
        set: {
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          category: row.category,
        },
      });
  return { locations: rows.length };
}

function describe(e: EngineEvent): string {
  return (e.summary || e.title).slice(0, 5000);
}

/** Events worth showing in The Forum: complete, not over, and (for series) coming up next. */
function shouldPublish(e: EngineEvent, seriesRank: Map<string, number>): boolean {
  if (e.status !== "active" || !e.publishable) return false;
  const end = new Date(e.endsAt ?? e.startsAt).getTime();
  if (end <= Date.now() - 6 * 3600_000) return false;
  if (e.series && e.series.size > 2)
    return (seriesRank.get(e.id) ?? Number.POSITIVE_INFINITY) < SERIES_WINDOW;
  return true;
}

/** Rank each upcoming occurrence within its series by start time (0 = next). */
function rankSeries(all: EngineEvent[]): Map<string, number> {
  const bySeries = new Map<string, EngineEvent[]>();
  const now = Date.now() - 6 * 3600_000;
  for (const e of all) {
    if (!e.series || e.status !== "active") continue;
    if (new Date(e.endsAt ?? e.startsAt).getTime() <= now) continue;
    const list = bySeries.get(e.series.id) ?? [];
    list.push(e);
    bySeries.set(e.series.id, list);
  }
  const rank = new Map<string, number>();
  for (const list of bySeries.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    list.forEach((e, i) => rank.set(e.id, i));
  }
  return rank;
}

export async function syncEvents(client = engineClient()) {
  const bot = await botUserId();
  // Latest state of every event, read from the start of the change feed.
  const latest = new Map<string, EngineEvent>();
  let cursor = 0;
  for (;;) {
    const { changes, next } = await client.eventChanges(cursor, 1000);
    if (!changes.length) break;
    for (const e of changes) latest.set(e.id, e);
    cursor = next;
  }
  const all = [...latest.values()];
  const seriesRank = rankSeries(all);
  const knownLocations = new Set(
    (await db.select({ id: campusLocations.id }).from(campusLocations)).map((l) => l.id),
  );
  const orgByExternal = new Map(
    (
      await db
        .select({ id: organizations.id, externalId: organizations.externalId })
        .from(organizations)
    )
      .filter((o) => o.externalId)
      .map((o) => [o.externalId as string, o.id]),
  );
  const stats = { seen: 0, published: 0, unpublished: 0, skipped: 0 };

  {
    const changes = all;
    for (const e of changes) {
      stats.seen++;
      const key = `ie:${e.id}`;
      const [existing] = await db
        .select({
          id: events.id,
          status: events.status,
          isPublic: events.isPublic,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .where(eq(events.sourceMessageId, key));
      const publish = shouldPublish(e, seriesRank);
      const isPublished = existing?.status === "published" && existing.isPublic;
      // Unchanged upstream and already in the desired state: nothing to write.
      if (
        existing &&
        publish === isPublished &&
        existing.updatedAt.getTime() >= new Date(e.updatedAt).getTime()
      ) {
        stats.skipped++;
        continue;
      }
      if (!publish) {
        if (existing && isPublished) {
          await db
            .update(events)
            .set({ status: "draft", isPublic: false, updatedAt: new Date() })
            .where(eq(events.id, existing.id));
          stats.unpublished++;
        } else stats.skipped++;
        continue;
      }
      const locationId =
        e.location.id && knownLocations.has(e.location.id) ? e.location.id : TBA_LOCATION.id;
      const detail =
        [
          e.location.room ? `Room ${e.location.room}` : null,
          locationId === "tba" ? e.location.text : null,
        ]
          .filter(Boolean)
          .join(" · ") || null;
      const values = {
        title: e.title.slice(0, 200),
        description: describe(e),
        datetime: new Date(e.startsAt),
        endDatetime: e.endsAt ? new Date(e.endsAt) : null,
        locationId,
        locationDetail: detail?.slice(0, 200) ?? null,
        orgId: e.host ? (orgByExternal.get(e.host.id) ?? null) : null,
        creatorId: bot,
        flyerUrl: e.imageUrl,
        externalLink: e.rsvpUrl,
        sourceUrl: e.source.url,
        isPublic: true,
        status: "published" as const,
        source: e.source.kind,
        sourceMessageId: key,
        updatedAt: new Date(),
      };
      let eventId = existing?.id;
      if (eventId) await db.update(events).set(values).where(eq(events.id, eventId));
      else {
        const [row] = await db.insert(events).values(values).returning({ id: events.id });
        eventId = row?.id;
      }
      if (eventId) {
        const tags = e.tags.filter((t): t is EventTag => eventTagValues.has(t));
        await db.delete(eventTags).where(eq(eventTags.eventId, eventId));
        if (tags.length)
          await db
            .insert(eventTags)
            .values(tags.map((tag) => ({ eventId: eventId as string, tag })));
      }
      stats.published++;
    }
  }
  await db
    .insert(syncState)
    .values({ key: CURSOR_KEY, value: String(cursor) })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { value: String(cursor), updatedAt: sql`now()` },
    });
  return { ...stats, cursor };
}

if (import.meta.main) {
  const client = engineClient();
  const started = Date.now();
  console.log("organizations", await syncOrganizations(client));
  console.log("locations", await syncLocations(client));
  console.log("events", await syncEvents(client));
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
}
