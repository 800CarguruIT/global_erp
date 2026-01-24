-- 077_recovery_requests_schedule.sql

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
