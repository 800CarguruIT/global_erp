-- Legacy estimate financial fields on line_items.
-- Used only for carguru2-based estimate flow.

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS approved_cost numeric(14,2) NULL;

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS approved_sale numeric(14,2) NULL;

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0;

UPDATE line_items
SET approved_sale = approved_cost
WHERE approved_sale IS NULL
  AND approved_cost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_items_inspection_is_add
  ON line_items (inspection_id, is_add);
