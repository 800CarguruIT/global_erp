-- 014_estimates.sql

CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  inspection_id uuid NOT NULL,
  lead_id uuid NULL,
  car_id uuid NULL,
  customer_id uuid NULL,
  status text NOT NULL,
  currency text NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_sale numeric(14,2) NOT NULL DEFAULT 0,
  total_discount numeric(14,2) NOT NULL DEFAULT 0,
  final_price numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_company_status ON estimates(company_id, status);
CREATE INDEX IF NOT EXISTS idx_estimates_inspection ON estimates(inspection_id);

CREATE TABLE IF NOT EXISTS estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  inspection_item_id uuid NULL,
  line_no integer NOT NULL,
  part_name text NOT NULL,
  description text NULL,
  type text NOT NULL DEFAULT 'genuine',
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  sale numeric(14,2) NOT NULL DEFAULT 0,
  gp_percent numeric(6,2) NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id, line_no);

CREATE OR REPLACE FUNCTION touch_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_estimates_updated_at ON estimates;
CREATE TRIGGER trg_touch_estimates_updated_at
BEFORE UPDATE ON estimates
FOR EACH ROW EXECUTE FUNCTION touch_estimates_updated_at();
