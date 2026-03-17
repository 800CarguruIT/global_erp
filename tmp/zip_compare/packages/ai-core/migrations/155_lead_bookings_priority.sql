-- 155_lead_bookings_priority.sql
-- Add booking priority for all lead booking scenarios.

BEGIN;

ALTER TABLE lead_bookings
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

ALTER TABLE lead_bookings
  DROP CONSTRAINT IF EXISTS lead_bookings_priority_check;

ALTER TABLE lead_bookings
  ADD CONSTRAINT lead_bookings_priority_check
  CHECK (priority IN ('low', 'medium', 'high'));

COMMIT;
