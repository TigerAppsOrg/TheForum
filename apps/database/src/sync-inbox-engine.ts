/**
 * Sync The Forum from InboxEngine (packages/inbox-engine), the shared source of truth for
 * Princeton organizations, campus venues and events.
 *
 *   bun run db:sync-engine            # orgs + venues + incremental events
 *   bun run db:sync-engine --full     # re-read the whole event feed from revision 0
 *
 * Env: DATABASE_URL, INBOX_ENGINE_URL, INBOX_ENGINE_TOKEN.
 *
 * - Organizations: every MyPrincetonU group, upserted on `external_id` ("mpu:<id>"). A manual
 *   Forum org with the same name is linked instead of duplicated. Forum-only fields (followers,
 *   members, events) are never touched.
 * - Venues: InboxEngine's campus gazetteer, upserted into campus_locations.
 * - Events: the revisioned change feed. Official MyPrincetonU events and publishable listserv
 *   extractions become published Forum events owned by the InboxEngine bot user; withdrawn or
 *   duplicate ones are unpublished (never deleted, so RSVPs survive).
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
  const origin =
    e.source.kind === "myprincetonu"
      ? "Imported from MyPrincetonU."
      : `Found in a ${e.source.listservs.join(" / ") || "campus listserv"} email.`;
  return `${e.summary || e.title}\n\n${origin}`.slice(0, 5000);
}

/** Events worth showing in The Forum: complete, single-occurrence and not already over. */
function shouldPublish(e: EngineEvent): boolean {
  if (e.status !== "active" || !e.publishable) return false;
  const end = new Date(e.endsAt ?? e.startsAt).getTime();
  return end > Date.now() - 6 * 3600_000;
}

export async function syncEvents(client = engineClient(), options: { full?: boolean } = {}) {
  const bot = await botUserId();
  const [cursorRow] = await db.select().from(syncState).where(eq(syncState.key, CURSOR_KEY));
  let cursor = options.full ? 0 : Number(cursorRow?.value ?? 0);
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

  for (;;) {
    const { changes, next } = await client.eventChanges(cursor, 500);
    if (!changes.length) break;
    for (const e of changes) {
      stats.seen++;
      const key = `ie:${e.id}`;
      const [existing] = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.sourceMessageId, key));
      if (!shouldPublish(e)) {
        if (existing) {
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
        externalLink: e.rsvpUrl ?? e.source.url,
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
    cursor = next;
    await db
      .insert(syncState)
      .values({ key: CURSOR_KEY, value: String(cursor) })
      .onConflictDoUpdate({
        target: syncState.key,
        set: { value: String(cursor), updatedAt: sql`now()` },
      });
  }
  return { ...stats, cursor };
}

if (import.meta.main) {
  const full = process.argv.includes("--full");
  const client = engineClient();
  const started = Date.now();
  console.log("organizations", await syncOrganizations(client));
  console.log("locations", await syncLocations(client));
  console.log("events", await syncEvents(client, { full }));
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
}
