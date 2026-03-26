ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS approved_cost numeric(14,2) NULL;
