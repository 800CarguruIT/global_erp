-- 146_pre_inspection_forms.sql
-- Customer pre-inspection / pre-pickup mandatory form tracking.

CREATE TABLE IF NOT EXISTS pre_inspection_form_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  recovery_request_id uuid NULL REFERENCES recovery_requests(id) ON DELETE SET NULL,
  customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL,
  car_id uuid NULL REFERENCES cars(id) ON DELETE SET NULL,
  appointment_type text NOT NULL CHECK (appointment_type IN ('walkin', 'recovery')),
  appointment_at timestamptz NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  terms_accepted boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NULL,
  direct_sent_at timestamptz NULL,
  before_24h_sent_at timestamptz NULL,
  recovery_started_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pre_inspection_form_requests_lead_type
  ON pre_inspection_form_requests (lead_id, appointment_type);

CREATE INDEX IF NOT EXISTS idx_pre_inspection_form_requests_company_status
  ON pre_inspection_form_requests (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_inspection_form_requests_appointment
  ON pre_inspection_form_requests (appointment_at, status)
  WHERE appointment_at IS NOT NULL;

