-- Move approved type ownership to line_items (source of truth).

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS approved_type text NULL;

-- Backfill from existing estimate item mappings (one-time migration).
UPDATE line_items li
SET approved_type = ei.approved_type
FROM estimate_items ei
WHERE ei.inspection_item_id = li.id
  AND ei.approved_type IS NOT NULL
  AND (li.approved_type IS NULL OR li.approved_type = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_approved_type_check'
      AND conrelid = 'line_items'::regclass
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_approved_type_check
      CHECK (
        approved_type IS NULL
        OR LOWER(approved_type) IN ('oe', 'oem', 'aftm', 'used')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_line_items_approved_type
  ON line_items (approved_type);
