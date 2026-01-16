-- 066_line_items_part_ordered.sql

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS part_ordered integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_part_ordered_check'
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_part_ordered_check
        CHECK (part_ordered IN (0, 1));
  END IF;
END $$;
