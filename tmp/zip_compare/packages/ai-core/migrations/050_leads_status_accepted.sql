-- 050_leads_status_accepted.sql
-- Allow accepted lead status for branch acceptance flow.

BEGIN;

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
      'accepted'
    )
  );

COMMIT;
