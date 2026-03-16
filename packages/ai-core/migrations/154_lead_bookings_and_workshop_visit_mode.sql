-- 154_lead_bookings_and_workshop_visit_mode.sql
-- Add dedicated booking records for leads and workshop visit mode metadata.

BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS workshop_visit_mode text NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS service_type text NULL,
  ADD COLUMN IF NOT EXISTS pickup_from text NULL,
  ADD COLUMN IF NOT EXISTS dropoff_to text NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_workshop_visit_mode_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_workshop_visit_mode_check
  CHECK (
    workshop_visit_mode IS NULL OR workshop_visit_mode IN ('walkin', 'recovery')
  );

UPDATE leads
SET workshop_visit_mode = CASE
  WHEN lead_type = 'workshop' AND (
    COALESCE(NULLIF(TRIM(LOWER(service_type)), ''), '') IN ('pickup', 'recovery')
    OR COALESCE(NULLIF(TRIM(pickup_from), ''), '') <> ''
    OR COALESCE(NULLIF(TRIM(dropoff_to), ''), '') <> ''
  ) THEN 'recovery'
  WHEN lead_type = 'workshop' THEN 'walkin'
  ELSE workshop_visit_mode
END
WHERE lead_type = 'workshop'
  AND workshop_visit_mode IS NULL;

CREATE TABLE IF NOT EXISTS lead_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  booking_kind text NOT NULL CHECK (booking_kind IN ('rsa', 'recovery', 'workshop_walkin', 'workshop_recovery')),
  scheduled_at timestamptz NOT NULL,
  pickup_location text NULL,
  pickup_google_location text NULL,
  dropoff_location text NULL,
  dropoff_google_location text NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_bookings_company_lead
  ON lead_bookings(company_id, lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_bookings_active
  ON lead_bookings(company_id, lead_id, status)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS ux_lead_bookings_active_per_kind
  ON lead_bookings(lead_id, booking_kind)
  WHERE status = 'active';

COMMIT;
