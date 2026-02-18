-- Ensure part_quotes is linked directly to line_items for runtime flows.

UPDATE part_quotes pq
SET line_item_id = ei.inspection_item_id
FROM estimate_items ei
WHERE pq.line_item_id IS NULL
  AND pq.estimate_item_id = ei.id
  AND ei.inspection_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_part_quotes_company_line_item
  ON part_quotes (company_id, line_item_id, updated_at DESC);
