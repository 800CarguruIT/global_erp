-- 121_part_quotes_line_item_id.sql
ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS line_item_id uuid NULL REFERENCES line_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_part_quotes_line_item_id
  ON part_quotes (line_item_id);

