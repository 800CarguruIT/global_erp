CREATE TABLE IF NOT EXISTS integration_health (
  integration_type text NOT NULL CHECK (integration_type IN ('dialer', 'channel')),
  integration_id uuid NOT NULL,
  provider_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'unreachable', 'unknown')),
  last_checked_at timestamptz NOT NULL DEFAULT NOW(),
  last_error text NULL,
  PRIMARY KEY (integration_type, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_health_provider
  ON integration_health(provider_key);

CREATE INDEX IF NOT EXISTS idx_integration_health_status
  ON integration_health(status);
