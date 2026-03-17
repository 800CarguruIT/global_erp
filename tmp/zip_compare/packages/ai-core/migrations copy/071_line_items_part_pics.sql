ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS part_pic text NULL,
  ADD COLUMN IF NOT EXISTS scrap_pic text NULL;
