-- 018_invoices.sql

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL REFERENCES work_orders(id),
  estimate_id uuid NULL REFERENCES estimates(id),
  quality_check_id uuid NULL REFERENCES quality_checks(id),
  inspection_id uuid NULL REFERENCES inspections(id),
  lead_id uuid NULL,
  car_id uuid NULL,
  customer_id uuid NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'draft',
  payment_method text NULL,
  due_date date NULL,
  paid_at timestamptz NULL,
  total_sale numeric(14,2) NOT NULL DEFAULT 0,
  total_discount numeric(14,2) NOT NULL DEFAULT 0,
  final_amount numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  terms text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(company_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order ON invoices(work_order_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  work_order_item_id uuid NULL REFERENCES work_order_items(id) ON DELETE SET NULL,
  estimate_item_id uuid NULL REFERENCES estimate_items(id) ON DELETE SET NULL,
  line_no integer NOT NULL,
  name text NOT NULL,
  description text NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  line_sale numeric(14,2) NOT NULL DEFAULT 0,
  line_discount numeric(14,2) NOT NULL DEFAULT 0,
  line_final numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id, line_no);

CREATE OR REPLACE FUNCTION touch_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_invoices_updated_at ON invoices;
CREATE TRIGGER trg_touch_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION touch_invoices_updated_at();
