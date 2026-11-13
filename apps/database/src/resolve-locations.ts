/**
 * Review or repair locations resolved from InboxEngine.
 *
 *   bun run db:resolve-locations --report
 *   bun run db:resolve-locations --alias "Frist lawn tent" frist
 */
import { and, eq } from "drizzle-orm";

import { closeDb, db } from "./db";
import {
  type GazetteerPlace,
  type LocationResolverContext,
  locationAliasKeys,
  normalizeLocationText,
  resolveEventLocation,
} from "./location-resolver";
import { locationChanged } from "./map-engine-event";
import { events, campusLocations, locationAliases } from "./schema";
import gazetteer from "./seeddata/location-gazetteer.json";

async function locationContext(): Promise<LocationResolverContext> {
  return {
    campusLocations: await db
      .select({ id: campusLocations.id, name: campusLocations.name })
      .from(campusLocations),
    locationAliases: await db
      .select({
        aliasNormalized: locationAliases.aliasNormalized,
        locationId: locationAliases.locationId,
      })
      .from(locationAliases),
    gazetteer: gazetteer as GazetteerPlace[],
  };
}

async function unresolvedEvents() {
  return db
    .select({
      id: events.id,
      locationId: events.locationId,
      locationDetail: events.locationDetail,
      locationText: events.locationText,
      locationResolution: events.locationResolution,
    })
    .from(events)
    .where(eq(events.locationResolution, "unresolved"));
}

async function report() {
  const counts = new Map<string, number>();
  for (const event of await unresolvedEvents()) {
    if (!event.locationText) continue;
    counts.set(event.locationText, (counts.get(event.locationText) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .sort(
      ([leftText, leftCount], [rightText, rightCount]) =>
        rightCount - leftCount || leftText.localeCompare(rightText),
    )
    .map(([text, count]) => ({ count, text }));
  console.table(rows);
}

async function addAlias(text: string, locationId: string) {
  const normalized = normalizeLocationText(text);
  if (!normalized) throw new Error("Alias text must contain letters or numbers");

  const [location] = await db
    .select({ id: campusLocations.id })
    .from(campusLocations)
    .where(eq(campusLocations.id, locationId));
  if (!location) throw new Error(`Unknown campus location: ${locationId}`);

  await db
    .insert(locationAliases)
    .values({ aliasNormalized: normalized, locationId })
    .onConflictDoUpdate({
      target: locationAliases.aliasNormalized,
      set: { locationId },
    });

  const ctx = await locationContext();
  let updated = 0;
  for (const event of await unresolvedEvents()) {
    if (!event.locationText || !locationAliasKeys(event.locationText).includes(normalized))
      continue;
    const resolved = resolveEventLocation({ text: event.locationText }, ctx);
    const locationDetail =
      [
        resolved.room ? `Room ${resolved.room}` : null,
        resolved.locationId === "tba" ? event.locationText : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200) || null;
    const nextLocation = {
      locationId: resolved.locationId,
      locationDetail,
      locationText: event.locationText,
      locationResolution: resolved.resolution,
    };
    if (!locationChanged(event, nextLocation)) continue;
    const rows = await db
      .update(events)
      .set({
        ...nextLocation,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, event.id), eq(events.locationResolution, "unresolved")))
      .returning({ id: events.id });
    updated += rows.length;
  }
  console.log(
    `Alias "${normalized}" now points to ${locationId}; re-resolved ${updated} event(s).`,
  );
}

const args = Bun.argv.slice(2);
try {
  if (args[0] === "--report" && args.length === 1) {
    await report();
  } else if (args[0] === "--alias" && args.length === 3) {
    await addAlias(args[1] ?? "", args[2] ?? "");
  } else {
    throw new Error(
      'Usage: bun run db:resolve-locations --report | bun run db:resolve-locations --alias "<text>" <locationId>',
    );
  }
} finally {
  await closeDb();
}
