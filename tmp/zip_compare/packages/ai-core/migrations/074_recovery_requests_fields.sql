-- 074_recovery_requests_fields.sql

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS assigned_to uuid NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'New',
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS pickup_video text,
  ADD COLUMN IF NOT EXISTS dropoff_video text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  ALTER TABLE recovery_requests
    ADD CONSTRAINT recovery_requests_status_check
      CHECK (status IN ('Pending', 'Cancelled', 'Done'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE recovery_requests
    ADD CONSTRAINT recovery_requests_stage_check
      CHECK (stage IN ('New', 'Accepted', 'Reached', 'Picked Up', 'Dropped Off'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
