-- 075_recovery_requests_journey.sql

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS agent_name text,
  ADD COLUMN IF NOT EXISTS agent_phone text,
  ADD COLUMN IF NOT EXISTS agent_car_plate text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_reached_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_terms_shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_terms_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_from_customer boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_remarks text,
  ADD COLUMN IF NOT EXISTS pickup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dropoff_reached_at timestamptz,
  ADD COLUMN IF NOT EXISTS dropoff_remarks text;
