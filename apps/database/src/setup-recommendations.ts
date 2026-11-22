/** Idempotent production data setup; never creates demo users or events. */
import { eq, sql } from "drizzle-orm";
import { campusAreaForLocation } from "./campus-regions";
import { db } from "./db";
import { campusLocations, eventTagEmbeddings, eventTagEnum } from "./schema";

export async function setupRecommendations({ dryRun = false }: { dryRun?: boolean } = {}) {
  const rows: { tag: string; embedding: number[] }[] = await Bun.file(
    `${import.meta.dir}/seeddata/eventTags_embeddings.json`,
  ).json();
  const tags = new Set<string>(eventTagEnum.enumValues);
  for (const row of rows) {
    if (
      !tags.has(row.tag) ||
      row.embedding.length !== 1536 ||
      !row.embedding.every(Number.isFinite)
    ) {
      throw new Error(`Invalid tag embedding: ${row.tag}`);
    }
  }
  if (rows.length !== tags.size || new Set(rows.map((row) => row.tag)).size !== tags.size) {
    throw new Error("Expected exactly one embedding for every event tag");
  }
  const locations = await db.select().from(campusLocations);
  if (dryRun) {
    return {
      locations: locations.length,
      embeddings: rows.length,
      areaChanges: locations.flatMap((location) => {
        const area = campusAreaForLocation(location);
        return area === location.area
          ? []
          : [{ id: location.id, name: location.name, oldArea: location.area, newArea: area }];
      }),
    };
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(eventTagEmbeddings)
      .values(
        rows.map((row) => ({
          tagName: row.tag as (typeof eventTagEnum.enumValues)[number],
          embedding: row.embedding,
        })),
      )
      .onConflictDoUpdate({
        target: eventTagEmbeddings.tagName,
        set: { embedding: sql`excluded.embedding` },
      });
    for (const location of locations) {
      await tx
        .update(campusLocations)
        .set({ area: campusAreaForLocation(location) })
        .where(eq(campusLocations.id, location.id));
    }
  });
  return { locations: locations.length, embeddings: rows.length };
}

if (import.meta.main) {
  try {
    console.log(
      JSON.stringify(
        await setupRecommendations({ dryRun: Bun.argv.includes("--dry-run") }),
        null,
        2,
      ),
    );
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
