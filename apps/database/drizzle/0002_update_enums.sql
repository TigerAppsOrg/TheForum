ALTER TYPE "public"."pipeline_log_status" ADD VALUE 'needs_review';--> statement-breakpoint

CREATE TABLE "event_tag_embeddings" (
    "tag_name" "event_tag" PRIMARY KEY NOT NULL,
    "embedding" vector(1536) NOT NULL
);
--> statement-breakpoint

ALTER TABLE "event_tag_embeddings" ALTER COLUMN "tag_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "event_tags" ALTER COLUMN "tag" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_interests" ALTER COLUMN "tag" SET DATA TYPE text;--> statement-breakpoint

DROP TYPE "public"."event_tag";--> statement-breakpoint
CREATE TYPE "public"."event_tag" AS ENUM('free food', 'career', 'research', 'academics', 'tech', 'entrepreneurship', 'politics', 'visual arts', 'performing arts', 'literature', 'culture', 'music', 'gaming', 'athletics', 'religion', 'sustainability', 'outdoors', 'wellness', 'community service', 'speaker event', 'social event', 'stem');--> statement-breakpoint

-- event_tag_embeddings is a new table, so a direct cast is safe here
ALTER TABLE "event_tag_embeddings" ALTER COLUMN "tag_name" SET DATA TYPE "public"."event_tag" USING "tag_name"::"public"."event_tag";--> statement-breakpoint

-- The mapping merges 'workshop' and 'academic' into 'academics'. A row set
-- containing BOTH old values for the same event/user would produce duplicate
-- composite-PK rows after conversion, so drop the redundant 'workshop' row
-- first wherever its 'academic' counterpart exists.
DELETE FROM "event_tags" et
  WHERE et."tag" = 'workshop'
  AND EXISTS (
    SELECT 1 FROM "event_tags" e2
    WHERE e2."event_id" = et."event_id" AND e2."tag" = 'academic'
  );--> statement-breakpoint

DELETE FROM "user_interests" ui
  WHERE ui."tag" = 'workshop'
  AND EXISTS (
    SELECT 1 FROM "user_interests" u2
    WHERE u2."user_id" = ui."user_id" AND u2."tag" = 'academic'
  );--> statement-breakpoint

-- Explicit mapping for event_tags
ALTER TABLE "event_tags" ALTER COLUMN "tag" SET DATA TYPE "public"."event_tag" USING (
  CASE "tag"
    WHEN 'free-food' THEN 'free food'
    WHEN 'workshop' THEN 'academics'
    WHEN 'performance' THEN 'performing arts'
    WHEN 'speaker' THEN 'speaker event'
    WHEN 'social' THEN 'social event'
    WHEN 'sports' THEN 'athletics'
    WHEN 'art' THEN 'visual arts'
    WHEN 'academic' THEN 'academics'
    WHEN 'cultural' THEN 'culture'
    WHEN 'community-service' THEN 'community service'
    WHEN 'religious' THEN 'religion'
    WHEN 'political' THEN 'politics'
    WHEN 'outdoor' THEN 'outdoors'
    ELSE "tag"
  END
)::"public"."event_tag";--> statement-breakpoint

-- Explicit mapping for user_interests
ALTER TABLE "user_interests" ALTER COLUMN "tag" SET DATA TYPE "public"."event_tag" USING (
  CASE "tag"
    WHEN 'free-food' THEN 'free food'
    WHEN 'workshop' THEN 'academics'
    WHEN 'performance' THEN 'performing arts'
    WHEN 'speaker' THEN 'speaker event'
    WHEN 'social' THEN 'social event'
    WHEN 'sports' THEN 'athletics'
    WHEN 'art' THEN 'visual arts'
    WHEN 'academic' THEN 'academics'
    WHEN 'cultural' THEN 'culture'
    WHEN 'community-service' THEN 'community service'
    WHEN 'religious' THEN 'religion'
    WHEN 'political' THEN 'politics'
    WHEN 'outdoor' THEN 'outdoors'
    ELSE "tag"
  END
)::"public"."event_tag";--> statement-breakpoint

ALTER TABLE "organizations" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."org_category";--> statement-breakpoint
CREATE TYPE "public"."org_category" AS ENUM('career', 'affinity', 'performing arts', 'academics', 'athletics', 'social event', 'culture', 'religion', 'politics', 'community service');--> statement-breakpoint

-- Explicit mapping for organizations — every renamed value must be listed,
-- since anything falling through ELSE must already be a valid new enum value
ALTER TABLE "organizations" ALTER COLUMN "category" SET DATA TYPE "public"."org_category" USING (
  CASE "category"
    WHEN 'academic' THEN 'academics'
    WHEN 'performance' THEN 'performing arts'
    WHEN 'cultural' THEN 'culture'
    WHEN 'athletic' THEN 'athletics'
    WHEN 'social' THEN 'social event'
    WHEN 'religious' THEN 'religion'
    WHEN 'political' THEN 'politics'
    WHEN 'service' THEN 'community service'
    ELSE "category"
  END
)::"public"."org_category";
