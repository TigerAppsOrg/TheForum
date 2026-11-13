CREATE TYPE "public"."location_resolution" AS ENUM('engine', 'online', 'alias', 'gazetteer', 'fuzzy', 'manual', 'unresolved');--> statement-breakpoint
CREATE TABLE "location_aliases" (
	"alias_normalized" varchar(250) PRIMARY KEY NOT NULL,
	"location_id" varchar(100) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location_text" varchar(300);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "locationResolution" "location_resolution";--> statement-breakpoint
UPDATE "events"
SET "locationResolution" = CASE
  WHEN "source_message_id" LIKE 'ie:%' AND "location_id" = 'tba' THEN 'unresolved'::"location_resolution"
  ELSE 'manual'::"location_resolution"
END;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "locationResolution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_location_id_campus_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."campus_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
