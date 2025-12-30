-- 020_quotes.sql

-- Quotes header (vendor parts + branch labor)
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  quote_type text NOT NULL, -- vendor_part | branch_labor
  status text NOT NULL DEFAULT 'draft', -- draft | submitted | approved | rejected | cancelled
  estimate_id uuid NULL,
  work_order_id uuid NULL,
  vendor_id uuid NULL,
  branch_id uuid NULL,
  currency text NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  valid_until date NULL,
  created_by uuid NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_company_status ON quotes (company_id, quote_type, status);
CREATE INDEX IF NOT EXISTS idx_quotes_estimate ON quotes (estimate_id);
CREATE INDEX IF NOT EXISTS idx_quotes_workorder ON quotes (work_order_id);

-- Quote line items
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  estimate_item_id uuid NULL,
  work_order_item_id uuid NULL,
  name text NOT NULL,
  description text NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  total_price numeric(14,2) NOT NULL DEFAULT 0,
  part_number text NULL,
  brand text NULL,
  part_type text NULL,
  eta_days integer NULL,
  labor_hours numeric(10,2) NULL,
  labor_rate numeric(14,2) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items (quote_id, line_no);

-- Ensure estimate_items has cost (internal)
ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS cost numeric(14,2) NOT NULL DEFAULT 0;

-- Work order internal labor cost
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS labor_cost numeric(14,2) NOT NULL DEFAULT 0;

-- Touch trigger
CREATE OR REPLACE FUNCTION touch_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_quotes_updated_at ON quotes;
CREATE TRIGGER trg_touch_quotes_updated_at
BEFORE UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION touch_quotes_updated_at();
