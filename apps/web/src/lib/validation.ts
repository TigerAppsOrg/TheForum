import {
  campusRegionEnum,
  eventStatusEnum,
  eventTagEnum,
  interactionTypeEnum,
  itemTypeEnum,
  orgCategoryEnum,
} from "@the-forum/database";
import { z } from "zod";
import { FEED_SORTS } from "~/lib/feed-ranking";

/**
 * Parse server-action input, throwing a readable Error on failure.
 *
 * Server actions are public HTTP endpoints — TypeScript types on their
 * parameters are not enforced at runtime, so every action runs its input
 * through a schema before touching the database.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new Error(`Invalid input — ${path}${issue?.message ?? "validation failed"}`);
  }
  return result.data;
}

/** Any 8-4-4-4-12 hex id (Postgres `uuid`). */
export const idSchema = z.guid();

// Enum schemas derived from the pgEnums, so they can never drift from the DB.
export const eventTagSchema = z.enum(eventTagEnum.enumValues);
export const orgCategorySchema = z.enum(orgCategoryEnum.enumValues);
export const campusRegionSchema = z.enum(campusRegionEnum.enumValues);
export const eventStatusSchema = z.enum(eventStatusEnum.enumValues);
export const interactionTypeSchema = z.enum(interactionTypeEnum.enumValues);
export const itemTypeSchema = z.enum(itemTypeEnum.enumValues);

/** Explore sort ("For you" / "Soonest" / "Recently posted"), e.g. from `?sort=`. */
export const feedSortSchema = z.enum(FEED_SORTS);

/** De-duplicated list of enum values (at most one of each). */
export function uniqueEnumArray<E extends z.ZodEnum>(schema: E) {
  return z
    .array(schema)
    .max(schema.options.length * 2)
    .transform((values) => [...new Set(values)]);
}

/** Campus location ids are short slugs (varchar(100)), e.g. "frist". */
export const locationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid location");

/** An ISO-ish date string → Date, rejecting unparseable and absurd values. */
export const dateInputSchema = z
  .string()
  .max(64)
  .transform((s, ctx) => {
    const d = new Date(s);
    const year = d.getUTCFullYear();
    if (Number.isNaN(d.getTime()) || year < 2000 || year > 2100) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

/** Optional external link: absent/empty → null, otherwise a plain https URL. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => {
      if (v === null) return true;
      try {
        const url = new URL(v);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    },
    { message: "Link must be a valid https:// URL" },
  );
