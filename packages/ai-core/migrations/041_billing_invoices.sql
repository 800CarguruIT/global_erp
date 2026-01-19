-- Billing invoices for subscriptions/AI usage (no work order dependency)
CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  subscription_id uuid NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | canceled
  currency text NOT NULL DEFAULT 'USD',
  total_amount numeric(18,4) NOT NULL DEFAULT 0,
  due_date date NULL,
  paid_at timestamptz NULL,
  payment_ref text NULL,
  reference text NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  name text NOT NULL,
  description text NULL,
  amount numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_company ON billing_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_lines_invoice ON billing_invoice_lines(invoice_id);
