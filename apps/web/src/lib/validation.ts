import { eventTagEnum, orgCategoryEnum } from "@the-forum/database";
import { z } from "zod";

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

export const eventTagSchema = z.enum(eventTagEnum.enumValues);
export const orgCategorySchema = z.enum(orgCategoryEnum.enumValues);
