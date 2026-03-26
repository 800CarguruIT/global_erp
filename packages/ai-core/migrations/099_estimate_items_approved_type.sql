ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS approved_type text NULL;
