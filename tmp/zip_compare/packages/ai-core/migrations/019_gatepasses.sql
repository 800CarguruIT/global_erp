-- 019_gatepasses.sql

-- Gatepasses control final handover
CREATE TABLE IF NOT EXISTS gatepasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  quality_check_id uuid NULL REFERENCES quality_checks(id),
  car_id uuid NULL,
  customer_id uuid NULL,

  handover_type text NOT NULL DEFAULT 'branch', -- branch | dropoff_recovery
  status text NOT NULL DEFAULT 'pending', -- pending | ready | released | cancelled

  invoice_status_snapshot text NOT NULL,
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  payment_ok boolean NOT NULL DEFAULT false,
  supervisor_id uuid NULL,
  supervisor_approved_at timestamptz NULL,

  customer_signed boolean NOT NULL DEFAULT false,
  customer_name text NULL,
  customer_id_number text NULL,
  handover_form_ref text NULL,
  customer_signature_ref text NULL,
  final_video_ref text NULL,
  final_note text NULL,

  recovery_lead_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatepasses_company_status ON gatepasses (company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gatepasses_invoice ON gatepasses (invoice_id);

-- Lead lock flags
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;

-- touch trigger
CREATE OR REPLACE FUNCTION touch_gatepasses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_gatepasses_updated_at ON gatepasses;
CREATE TRIGGER trg_touch_gatepasses_updated_at
BEFORE UPDATE ON gatepasses
FOR EACH ROW EXECUTE FUNCTION touch_gatepasses_updated_at();
