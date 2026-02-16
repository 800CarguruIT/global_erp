-- 072_line_items_is_add.sql
ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS is_add smallint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_is_add_check'
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_is_add_check
      CHECK (is_add IN (0, 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_line_items_inspection_job_add
  ON line_items (inspection_id, job_card_id, is_add);
