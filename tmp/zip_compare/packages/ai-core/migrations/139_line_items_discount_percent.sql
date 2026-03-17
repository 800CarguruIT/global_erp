-- Store legacy discount percent separately from discount amount.
-- discount_amount remains source of truth for monetary totals.

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS discount_percent numeric(8,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_line_items_discount_percent
  ON line_items (discount_percent);
