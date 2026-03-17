-- 158_inspection_collect_car_review_logs.sql
-- Logs collect-car review decisions and re-upload evidence for inspection audit/reporting.

BEGIN;

CREATE TABLE IF NOT EXISTS inspection_collect_car_review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('recovery', 'walkin', 'unknown')),
  source_media jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_difference boolean NOT NULL DEFAULT FALSE,
  note text NULL,
  reupload_media jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collect_car_logs_company_inspection
  ON inspection_collect_car_review_logs(company_id, inspection_id, reviewed_at DESC);

COMMIT;
