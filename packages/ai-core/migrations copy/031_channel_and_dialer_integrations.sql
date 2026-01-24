-- 031_channel_and_dialer_integrations.sql
-- Create tables for channel and dialer integrations (global + company scope)

CREATE TABLE IF NOT EXISTS integration_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'company')),
  company_id uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_type text NOT NULL,
  provider_key text NOT NULL,
  auth_type text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhooks jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_channels_scope ON integration_channels(scope, company_id);
CREATE INDEX IF NOT EXISTS idx_integration_channels_provider ON integration_channels(provider_key);
CREATE INDEX IF NOT EXISTS idx_integration_channels_active ON integration_channels(is_active);

CREATE TABLE IF NOT EXISTS integration_dialers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  label text NOT NULL,
  auth_type text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhooks jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_global boolean NOT NULL DEFAULT FALSE,
  company_id uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_dialers_global_company ON integration_dialers(is_global, company_id);
CREATE INDEX IF NOT EXISTS idx_integration_dialers_provider ON integration_dialers(provider);
CREATE INDEX IF NOT EXISTS idx_integration_dialers_active ON integration_dialers(is_active);

CREATE TABLE IF NOT EXISTS integration_dialer_metadata (
  dialer_id uuid NOT NULL REFERENCES integration_dialers(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (dialer_id, key)
);

CREATE TABLE IF NOT EXISTS integration_dialer_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialer_id uuid NOT NULL REFERENCES integration_dialers(id) ON DELETE CASCADE,
  event text NOT NULL,
  url text NOT NULL,
  secret text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_dialer_webhooks_dialer ON integration_dialer_webhooks(dialer_id);
