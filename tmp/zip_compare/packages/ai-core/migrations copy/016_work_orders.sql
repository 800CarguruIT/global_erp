-- 016_work_orders.sql

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  estimate_id uuid NOT NULL,
  inspection_id uuid NULL,
  lead_id uuid NULL,
  car_id uuid NULL,
  customer_id uuid NULL,
  branch_id uuid NULL,
  status text NOT NULL DEFAULT 'draft',
  queue_reason text NULL,
  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_company_status ON work_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_estimate ON work_orders(estimate_id);

CREATE TABLE IF NOT EXISTS work_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  estimate_item_id uuid NOT NULL REFERENCES estimate_items(id) ON DELETE RESTRICT,
  line_no integer NOT NULL,
  part_name text NOT NULL,
  description text NULL,
  is_part boolean NOT NULL DEFAULT true,
  is_labor boolean NOT NULL DEFAULT false,
  required_qty numeric(10,2) NOT NULL DEFAULT 1,
  issued_qty numeric(10,2) NOT NULL DEFAULT 0,
  work_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_items_order ON work_order_items(work_order_id, line_no);

CREATE TABLE IF NOT EXISTS work_order_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_item_id uuid NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  kind text NOT NULL,
  file_ref text NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_media_item ON work_order_media(work_order_item_id, kind);

CREATE OR REPLACE FUNCTION touch_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_work_orders_updated_at ON work_orders;
CREATE TRIGGER trg_touch_work_orders_updated_at
BEFORE UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION touch_work_orders_updated_at();
