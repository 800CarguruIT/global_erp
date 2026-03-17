-- 076_recovery_requests_verification.sql

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS verification_cost numeric,
  ADD COLUMN IF NOT EXISTS verification_sale numeric,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
