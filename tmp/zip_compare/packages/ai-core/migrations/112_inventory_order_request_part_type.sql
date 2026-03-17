-- Add part type to inventory order request items
BEGIN;

ALTER TABLE inventory_order_request_items
  ADD COLUMN IF NOT EXISTS part_type text NULL;

COMMIT;
