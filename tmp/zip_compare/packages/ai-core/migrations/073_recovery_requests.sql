-- 073_recovery_requests.sql

CREATE TABLE IF NOT EXISTS recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to uuid NULL,
  pickup_location text,
  dropoff_location text,
  type text NOT NULL CHECK (type IN ('pickup', 'dropoff')),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Cancelled', 'Done')),
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Accepted', 'Reached', 'Picked Up', 'Dropped Off')),
  remarks text,
  pickup_video text,
  dropoff_video text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_requests_lead_id ON recovery_requests(lead_id);
