-- 051_leads_checkin_and_car_in.sql
-- Add check-in timestamp and allow car_in status.

BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS checkin_at timestamptz NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_lead_status_check
  CHECK (
    lead_status IN (
      'open',
      'processing',
      'closed_won',
      'lost',
      'assigned',
      'onboarding',
      'inprocess',
      'completed',
      'closed',
      'accepted',
      'car_in'
    )
  );

COMMIT;
