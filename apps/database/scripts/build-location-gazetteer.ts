/**
 * Produces the compact, database-local map lookup used by location resolution.
 *
 * Run from the repository root:
 *   bun run apps/database/scripts/build-location-gazetteer.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type Poi = {
  id: number | string;
  name: string | null;
  alt_name: string | null;
  parent_id: number | string | null;
};

const source = resolve(
  import.meta.dir,
  "../../web/src/app/(app)/map/_assets/campus-data/pois.json",
);
const destination = resolve(import.meta.dir, "../src/seeddata/location-gazetteer.json");

const pois = JSON.parse(await readFile(source, "utf8")) as Poi[];
const gazetteer = pois.map(({ id, name, alt_name, parent_id }) => ({
  id,
  name,
  alt_name,
  parent_id,
}));

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(gazetteer, null, 2)}\n`);
console.log(`wrote ${gazetteer.length} places to ${destination}`);
