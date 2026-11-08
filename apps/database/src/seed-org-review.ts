/** TIG-308 organization review fixtures. See seeddata/org-review.md. */
import { eq } from "drizzle-orm";
import {
  events,
  campusLocations,
  eventTags,
  orgFollowers,
  organizations,
  userInterests,
  users,
} from "./schema";
import { reviewOrganizations } from "./seeddata/org-review";

if (Bun.argv.includes("--dry-run")) {
  console.log({
    organizations: reviewOrganizations.length,
    categories: new Set(reviewOrganizations.map((org) => org.category)).size,
    missingDescriptions: reviewOrganizations.filter((org) => !org.description).length,
    missingLogos: reviewOrganizations.filter((org) => !org.logoUrl).length,
    offices: reviewOrganizations.filter((org) => org.groupType === "University Office").length,
    users: 24,
    events: 12,
    pagesAt20: Math.ceil(reviewOrganizations.length / 20),
  });
  process.exit(0);
}

// Check before importing the lazy database client. No remote override for this fixture.
const target = new URL(process.env.DATABASE_URL ?? "postgres://missing");
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
) {
  throw new Error("TIG-308 fixtures require a local, non-production DATABASE_URL.");
}

const { db } = await import("./db");
try {
  await db.transaction(async (tx) => {
    const demoUsers = [];
    for (let i = 0; i < 24; i++) {
      const netId = `tig308_demo_${String(i + 1).padStart(2, "0")}`;
      await tx
        .insert(users)
        .values({
          netId,
          email: `${netId}@example.invalid`,
          displayName: `TIG-308 Demo ${i + 1}`,
          classYear: "2029",
          onboarded: true,
        })
        .onConflictDoNothing();
      const [user] = await tx.select().from(users).where(eq(users.netId, netId));
      if (!user || user.email !== `${netId}@example.invalid`) {
        throw new Error(`Demo user collision: ${netId}`);
      }
      demoUsers.push(user);
    }
    const viewer = demoUsers[0];
    await tx
      .insert(userInterests)
      .values([
        { userId: viewer.id, tag: "academics" },
        { userId: viewer.id, tag: "culture" },
      ])
      .onConflictDoNothing();
    await tx
      .insert(campusLocations)
      .values({
        id: "seed-tig-308",
        name: "TIG-308 Demo Meeting Room",
        latitude: 40.3469,
        longitude: -74.6551,
        category: "social",
      })
      .onConflictDoNothing();

    for (const [index, fixture] of reviewOrganizations.entries()) {
      const [existing] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.externalId, fixture.externalId as string));
      if (existing && existing.source !== "seed") {
        throw new Error(`Non-seed organization collision: ${fixture.externalId}`);
      }
      const [org] = existing
        ? await tx
            .update(organizations)
            .set(fixture)
            .where(eq(organizations.id, existing.id))
            .returning()
        : await tx.insert(organizations).values(fixture).returning();

      // Most rows intentionally have zero followers; others have 1, 3, 8, or 24.
      const followerCount = [0, 0, 0, 1, 3, 8, 24][index % 7];
      if (followerCount) {
        await tx
          .insert(orgFollowers)
          .values(
            demoUsers.slice(0, followerCount).map((user) => ({ orgId: org.id, userId: user.id })),
          )
          .onConflictDoNothing();
      }
      if (index < 12) {
        const sourceMessageId = `seed:tig-308:event:${index}`;
        const datetime = new Date(Date.now() + (index - 4) * 86400000);
        const [existingEvent] = await tx
          .select()
          .from(events)
          .where(eq(events.sourceMessageId, sourceMessageId));
        if (existingEvent && existingEvent.source !== "seed") {
          throw new Error(`Non-seed event collision: ${sourceMessageId}`);
        }
        const values = {
          sourceMessageId,
          source: "seed",
          orgId: org.id,
          creatorId: viewer.id,
          title: `TIG-308 Demo Meeting ${index + 1}`,
          description: "Fictional activity for organization design review.",
          datetime,
          endDatetime: new Date(datetime.getTime() + 3600000),
          locationId: "seed-tig-308",
        };
        let eventId = existingEvent?.id;
        if (existingEvent) {
          await tx.update(events).set(values).where(eq(events.id, existingEvent.id));
        } else {
          const [inserted] = await tx.insert(events).values(values).returning({ id: events.id });
          eventId = inserted.id;
        }
        if (eventId) {
          await tx
            .insert(eventTags)
            .values([
              { eventId, tag: "academics" },
              { eventId, tag: "culture" },
            ])
            .onConflictDoNothing();
        }
      }
    }
  });
  console.log("TIG-308: seeded 312 organizations, 24 demo users, and 12 events.");
  process.exit(0);
} catch (error) {
  console.error("TIG-308 seed rolled back:", error);
  process.exit(1);
}
