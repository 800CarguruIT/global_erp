-- integration_events table to log outbound/inbound activity
CREATE TABLE IF NOT EXISTS integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type text NOT NULL, -- 'dialer' | 'channel'
  integration_id uuid NOT NULL,
  provider_key text NOT NULL,
  direction text NOT NULL, -- 'outbound' | 'inbound'
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_events_type_id
  ON integration_events (integration_type, integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_events_provider_created
  ON integration_events (provider_key, created_at);
