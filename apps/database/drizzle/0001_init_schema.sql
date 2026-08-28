CREATE TYPE "public"."campus_region" AS ENUM('central', 'east', 'west', 'south', 'north', 'off-campus');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."event_tag" AS ENUM('free-food', 'workshop', 'performance', 'speaker', 'social', 'career', 'sports', 'music', 'art', 'academic', 'cultural', 'community-service', 'religious', 'political', 'tech', 'gaming', 'outdoor', 'wellness');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('view', 'click', 'rsvp', 'save', 'share', 'hide');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('event', 'organization');--> statement-breakpoint
CREATE TYPE "public"."location_category" AS ENUM('academic', 'residential', 'athletic', 'social', 'administrative', 'library', 'dining', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('friend_request', 'event_reminder', 'org_new_event');--> statement-breakpoint
CREATE TYPE "public"."org_category" AS ENUM('career', 'affinity', 'performance', 'academic', 'athletic', 'social', 'cultural', 'religious', 'political', 'service');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'officer', 'member');--> statement-breakpoint
CREATE TYPE "public"."pipeline_log_status" AS ENUM('success', 'skipped_not_event', 'duplicate', 'error');--> statement-breakpoint
CREATE TABLE "campus_locations" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"category" "location_category" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tags" (
	"event_id" uuid NOT NULL,
	"tag" "event_tag" NOT NULL,
	CONSTRAINT "event_tags_event_id_tag_pk" PRIMARY KEY("event_id","tag")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"datetime" timestamp NOT NULL,
	"end_datetime" timestamp,
	"location_id" varchar(100) NOT NULL,
	"org_id" uuid,
	"creator_id" uuid NOT NULL,
	"flyer_url" text,
	"cover_preset" varchar(50),
	"external_link" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"status" "event_status" DEFAULT 'published' NOT NULL,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"source_message_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_message_id_unique" UNIQUE("source_message_id")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_type" "item_type" DEFAULT 'event' NOT NULL,
	"interaction_type" "interaction_type" NOT NULL,
	"interaction_value" double precision NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listserv_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"org_id" uuid,
	"gmail_label" varchar(255),
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listserv_configs_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "listserv_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"listserv" varchar(100) NOT NULL,
	"subject" text NOT NULL,
	"author_name" varchar(255),
	"author_email" varchar(255),
	"date" timestamp with time zone,
	"body_text" text,
	"body_html" text,
	"is_hoagiemail" boolean DEFAULT false NOT NULL,
	"hoagiemail_sender_name" varchar(255),
	"hoagiemail_sender_email" varchar(255),
	"links" jsonb DEFAULT '[]'::jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"listserv_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listserv_emails_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_followers" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_followers_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	CONSTRAINT "org_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"logo_url" text,
	"category" "org_category" NOT NULL,
	"creator_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "pipeline_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"listserv_config_id" uuid,
	"status" "pipeline_log_status" NOT NULL,
	"error_text" text,
	"extracted_event_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rsvps_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "saved_events" (
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_events_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" uuid NOT NULL,
	"tag" "event_tag" NOT NULL,
	CONSTRAINT "user_interests_user_id_tag_pk" PRIMARY KEY("user_id","tag")
);
--> statement-breakpoint
CREATE TABLE "user_preference_vectors" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tag_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latent_vector" double precision[],
	"interaction_count" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_regions" (
	"user_id" uuid NOT NULL,
	"region" "campus_region" NOT NULL,
	CONSTRAINT "user_regions_user_id_region_pk" PRIMARY KEY("user_id","region")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"net_id" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"class_year" varchar(10),
	"major" varchar(255),
	"avatar_url" text,
	"is_org_leader" boolean DEFAULT false NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_net_id_unique" UNIQUE("net_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_campus_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."campus_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listserv_configs" ADD CONSTRAINT "listserv_configs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_followers" ADD CONSTRAINT "org_followers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_followers" ADD CONSTRAINT "org_followers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_logs" ADD CONSTRAINT "pipeline_logs_listserv_config_id_listserv_configs_id_fk" FOREIGN KEY ("listserv_config_id") REFERENCES "public"."listserv_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_logs" ADD CONSTRAINT "pipeline_logs_extracted_event_id_events_id_fk" FOREIGN KEY ("extracted_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_events" ADD CONSTRAINT "saved_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_events" ADD CONSTRAINT "saved_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preference_vectors" ADD CONSTRAINT "user_preference_vectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;