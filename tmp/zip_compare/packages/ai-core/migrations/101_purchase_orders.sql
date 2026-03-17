-- 101_purchase_orders.sql
--
-- Ensures the purchase order and line item tables exist for the procurement workflow.

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vendor_id uuid NULL,
  vendor_name text NULL,
  vendor_contact text NULL,
  po_number text NOT NULL,
  po_type text NOT NULL DEFAULT 'po',
  source_type text NOT NULL DEFAULT 'manual',
  quote_id uuid NULL,
  status text NOT NULL DEFAULT 'draft',
  currency text NULL,
  expected_date date NULL,
  notes text NULL,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_company_status ON purchase_orders (company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_company_number ON purchase_orders (company_id, po_number);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  estimate_item_id uuid NULL,
  parts_catalog_id uuid NULL,
  name text NOT NULL,
  description text NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  received_qty numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items (purchase_order_id, line_no);

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid NULL;

CREATE OR REPLACE FUNCTION touch_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_touch_purchase_orders_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION touch_purchase_orders_updated_at();
