/** Pure vector math; missing or malformed data never adds a ranking signal. */
export const TAG_EMBEDDING_DIMENSIONS = 1536;
export const SIMILARITY_CANDIDATE_TAG_CAP = 5;
export const SIMILARITY_CANDIDATE_MIN = 0.5;

export function validVector(
  vector: readonly number[] | null | undefined,
): vector is readonly number[] {
  return !!vector && vector.length > 0 && vector.every(Number.isFinite);
}

export function averageVectors(vectors: readonly (readonly number[])[]): number[] | null {
  const first = vectors.find(validVector);
  if (!first) return null;
  const sum = new Array<number>(first.length).fill(0);
  let count = 0;
  for (const vector of vectors) {
    if (!validVector(vector) || vector.length !== first.length) continue;
    for (let i = 0; i < sum.length; i++) sum[i] = (sum[i] ?? 0) + (vector[i] ?? 0);
    count++;
  }
  const mean = sum.map((value) => value / count);
  return validVector(mean) ? mean : null;
}

export function eventVector(
  tags: readonly string[],
  embeddings: ReadonlyMap<string, readonly number[]>,
): number[] | null {
  return averageVectors(
    [...new Set(tags)].flatMap((tag) => {
      const vector = embeddings.get(tag);
      return vector ? [vector] : [];
    }),
  );
}

/** Equal weight per distinct saved/RSVP'd event, not per tag or action. */
export function profileVector(
  eventIds: readonly string[],
  vectors: ReadonlyMap<string, readonly number[] | null>,
): number[] | null {
  return averageVectors(
    [...new Set(eventIds)].flatMap((id) => {
      const vector = vectors.get(id);
      return vector ? [vector] : [];
    }),
  );
}

export function cosineSimilarity(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
): number {
  if (!validVector(a) || !validVector(b) || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  const denominator = Math.sqrt(aa) * Math.sqrt(bb);
  const similarity = dot / denominator;
  return denominator > 0 && Number.isFinite(similarity) ? Math.max(0, Math.min(1, similarity)) : 0;
}

/** Bounded semantic-tag retrieval for the saturated candidate pool. */
export function similarProfileTags(
  profile: readonly number[] | null,
  embeddings: ReadonlyMap<string, readonly number[]>,
): string[] {
  return [...embeddings]
    .map(([tag, vector]) => ({ tag, score: cosineSimilarity(profile, vector) }))
    .filter(({ score }) => score >= SIMILARITY_CANDIDATE_MIN)
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .slice(0, SIMILARITY_CANDIDATE_TAG_CAP)
    .map(({ tag }) => tag);
}
