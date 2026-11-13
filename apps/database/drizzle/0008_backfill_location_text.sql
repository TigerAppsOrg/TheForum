UPDATE "events"
SET "location_text" = "location_detail"
WHERE "location_text" IS NULL
  AND "location_id" = 'tba'
  AND "location_detail" IS NOT NULL;
