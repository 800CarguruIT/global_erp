-- 145_call_ai_workflow_inquiries.sql
-- Step 2 foundation: persist inquiry -> lead conversion -> lead outcome lifecycle

CREATE TABLE IF NOT EXISTS call_ai_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  provider_call_id text NOT NULL,
  from_number text NULL,
  to_number text NULL,
  inquiry_status text NOT NULL DEFAULT 'new'
    CHECK (inquiry_status IN ('new', 'qualified', 'converted', 'dropped')),
  inquiry_summary text NULL,
  ai_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  converted_to_lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  conversion_status text NOT NULL DEFAULT 'not_converted'
    CHECK (conversion_status IN ('not_converted', 'converted', 'failed')),
  converted_at timestamptz NULL,
  lead_outcome text NULL
    CHECK (lead_outcome IN ('appointment', 'walkin_service_request', 'lost_lead')),
  outcome_reason text NULL,
  outcome_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_call_ai_inquiries_company_call
  ON call_ai_inquiries (company_id, provider_key, provider_call_id);

CREATE INDEX IF NOT EXISTS idx_call_ai_inquiries_company_created
  ON call_ai_inquiries (company_id, created_at DESC);

