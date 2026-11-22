import { describe, expect, test } from "bun:test";
import {
  averageVectors,
  cosineSimilarity,
  eventVector,
  profileVector,
  similarProfileTags,
} from "./event-similarity";

describe("tag-derived similarity", () => {
  const embeddings = new Map([
    ["art", [1, 0]],
    ["music", [0, 1]],
  ]);
  test("event vectors average available distinct tags", () => {
    expect(eventVector(["art", "music", "art", "missing"], embeddings)).toEqual([0.5, 0.5]);
    expect(eventVector(["missing"], embeddings)).toBeNull();
  });
  test("profile gives each distinct event equal weight", () => {
    const vectors = new Map([
      ["a", [1, 0]],
      ["b", [0.5, 0.5]],
      ["missing", null],
    ]);
    expect(profileVector(["a", "a", "b", "missing"], vectors)).toEqual([0.75, 0.25]);
    expect(profileVector([], vectors)).toBeNull();
  });
  test("cosine is scale invariant and bounded", () => {
    expect(cosineSimilarity([1, 0], [10, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0);
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(1 / Math.sqrt(2));
  });
  test("missing, zero, mismatched and nonfinite vectors are neutral", () => {
    for (const vector of [null, [], [0, 0], [1], [Number.NaN, 1], [Number.POSITIVE_INFINITY, 1]]) {
      expect(cosineSimilarity(vector, [1, 0])).toBe(0);
    }
    expect(averageVectors([])).toBeNull();
    expect(averageVectors([[1, 0], [Number.NaN, 0], [1]])).toEqual([1, 0]);
  });
  test("candidate tags are semantic, bounded and deterministic", () => {
    expect(similarProfileTags([1, 0], embeddings)).toEqual(["art"]);
    expect(similarProfileTags(null, embeddings)).toEqual([]);
    const many = new Map(Array.from({ length: 10 }, (_, i) => [`tag${i}`, [1, 0]]));
    expect(similarProfileTags([1, 0], many)).toEqual(["tag0", "tag1", "tag2", "tag3", "tag4"]);
  });
});
