-- 119_inspections_verification_and_cancellation.sql
-- Track verification and cancellation audit fields for inspections.

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS verified_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancel_remarks text NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_verified_at
  ON inspections (verified_at);

CREATE INDEX IF NOT EXISTS idx_inspections_cancelled_at
  ON inspections (cancelled_at);
