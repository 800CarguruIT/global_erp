-- Link PO line items to part quotes for receive/GRN traceability.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS quote_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_quote_id
  ON purchase_order_items (quote_id);

