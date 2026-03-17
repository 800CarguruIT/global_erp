-- Track whether PO line has been moved into inventory
BEGIN;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS moved_to_inventory boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_po_items_moved ON purchase_order_items (moved_to_inventory);

COMMIT;
