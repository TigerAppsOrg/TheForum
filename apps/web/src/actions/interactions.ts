"use server";

import { db, interactions } from "@the-forum/database";
import { z } from "zod";
import { auth } from "~/auth";
import { checkRateLimit } from "~/lib/rate-limit";
import { idSchema, interactionTypeSchema, itemTypeSchema } from "~/lib/validation";

/** Interaction weights — maps type to implicit feedback score */
const INTERACTION_WEIGHTS: Record<z.infer<typeof interactionTypeSchema>, number> = {
  view: 1.0,
  click: 2.0,
  share: 2.0,
  save: 3.0,
  rsvp: 5.0,
  hide: -1.0,
};

/** Serialized metadata cap. Callers send small context (source, position). */
const MAX_METADATA_BYTES = 1024;

const interactionSchema = z.object({
  itemId: idSchema,
  itemType: itemTypeSchema.default("event"),
  interactionType: interactionTypeSchema,
  metadata: z
    .record(z.string().max(64), z.unknown())
    .optional()
    .refine(
      (m) =>
        m === undefined || new TextEncoder().encode(JSON.stringify(m)).length <= MAX_METADATA_BYTES,
      "metadata too large",
    ),
});

/**
 * Log an implicit user interaction. Fire-and-forget — invalid, oversized or
 * rate-limited calls are dropped silently so logging never breaks the UX.
 */
export async function logInteraction(data: {
  itemId: string;
  itemType?: "event" | "organization";
  interactionType: "view" | "click" | "rsvp" | "save" | "share" | "hide";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return; // not logged in — skip silently

    const parsed = interactionSchema.safeParse(data);
    if (!parsed.success) return;
    if (!checkRateLimit("interaction", session.user.id).ok) return;

    const input = parsed.data;
    await db.insert(interactions).values({
      userId: session.user.id,
      itemId: input.itemId,
      itemType: input.itemType,
      interactionType: input.interactionType,
      interactionValue: INTERACTION_WEIGHTS[input.interactionType],
      metadata: input.metadata ?? null,
    });
  } catch {
    // Silently drop — logging should never break the app
  }
}
