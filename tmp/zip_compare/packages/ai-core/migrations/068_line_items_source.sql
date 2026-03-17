ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'inspection';

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS part_pic text NULL,
  ADD COLUMN IF NOT EXISTS scrap_pic text NULL;

UPDATE line_items
SET source = 'inspection'
WHERE source IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_source_check'
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_source_check
      CHECK (source IN ('inspection', 'estimate'));
  END IF;
END $$;
