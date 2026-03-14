ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS part_number text NULL,
  ADD COLUMN IF NOT EXISTS catalog_group_key text NULL,
  ADD COLUMN IF NOT EXISTS client_row_key text NULL,
  ADD COLUMN IF NOT EXISTS ai_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_recommendation text NULL;

CREATE INDEX IF NOT EXISTS idx_line_items_client_row_key
  ON line_items (client_row_key);

