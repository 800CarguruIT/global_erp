-- Restore purchase_order_id on inventory_movements for procurement receipts

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_purchase_order
  ON inventory_movements (purchase_order_id);
