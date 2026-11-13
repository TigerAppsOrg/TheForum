DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'locationResolution'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'location_resolution'
  ) THEN
    ALTER TABLE "events" RENAME COLUMN "locationResolution" TO "location_resolution";
  END IF;
END $$;
