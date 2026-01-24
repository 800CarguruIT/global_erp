-- 061_inspections_status_timestamps.sql
-- Add start/complete timestamps and normalize inspection status values.

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS start_at timestamptz NULL;

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS complete_at timestamptz NULL;

UPDATE inspections
SET status = 'pending'
WHERE status IN ('draft', 'in_progress');

UPDATE inspections
SET status = 'completed'
WHERE status = 'approved';

ALTER TABLE inspections
  ALTER COLUMN status SET DEFAULT 'pending';
