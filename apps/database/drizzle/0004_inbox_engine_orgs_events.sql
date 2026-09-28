CREATE TABLE "sync_state" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "creator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location_detail" varchar(200);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "source" varchar(20) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "external_id" varchar(64);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "acronym" varchar(40);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "group_type" varchar(120);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "group_url" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "socials" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "member_count" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_external_id_unique" UNIQUE("external_id");