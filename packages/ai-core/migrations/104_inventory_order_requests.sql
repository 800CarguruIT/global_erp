-- 104_inventory_order_requests.sql
-- Inventory order requests + inventory-request-aware procurement/quotes fields.

CREATE TABLE IF NOT EXISTS inventory_order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  request_number text NOT NULL,
  request_type text NOT NULL DEFAULT 'inventory',
  status text NOT NULL DEFAULT 'pending',
  estimate_id uuid NULL REFERENCES estimates(id) ON DELETE SET NULL,
  notes text NULL,
  created_by uuid NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_order_requests_company_number
  ON inventory_order_requests (company_id, request_number);

CREATE INDEX IF NOT EXISTS idx_inv_order_requests_company_status
  ON inventory_order_requests (company_id, status);

CREATE TABLE IF NOT EXISTS inventory_order_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES inventory_order_requests(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  estimate_item_id uuid NULL REFERENCES estimate_items(id) ON DELETE SET NULL,
  part_name text NOT NULL,
  part_number text NULL,
  part_brand text NULL,
  description text NULL,
  unit text NULL,
  category text NULL,
  subcategory text NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  ordered_qty numeric(10,2) NOT NULL DEFAULT 0,
  received_qty numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_order_request_items_request
  ON inventory_order_request_items (request_id, line_no);

ALTER TABLE parts_catalog
  ADD COLUMN IF NOT EXISTS category text NULL,
  ADD COLUMN IF NOT EXISTS subcategory text NULL,
  ADD COLUMN IF NOT EXISTS unit text NULL;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS inventory_request_item_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_inventory_request_item
  ON purchase_order_items (inventory_request_item_id);

ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS inventory_request_id uuid NULL,
  ADD COLUMN IF NOT EXISTS inventory_request_item_id uuid NULL;

ALTER TABLE part_quotes
  ALTER COLUMN estimate_id DROP NOT NULL,
  ALTER COLUMN estimate_item_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_part_quotes_inventory_request_item
  ON part_quotes (inventory_request_item_id);

CREATE OR REPLACE FUNCTION touch_inventory_order_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_order_requests_updated_at ON inventory_order_requests;
CREATE TRIGGER trg_touch_inventory_order_requests_updated_at
BEFORE UPDATE ON inventory_order_requests
FOR EACH ROW EXECUTE FUNCTION touch_inventory_order_requests_updated_at();

CREATE OR REPLACE FUNCTION touch_inventory_order_request_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_order_request_items_updated_at ON inventory_order_request_items;
CREATE TRIGGER trg_touch_inventory_order_request_items_updated_at
BEFORE UPDATE ON inventory_order_request_items
FOR EACH ROW EXECUTE FUNCTION touch_inventory_order_request_items_updated_at();
