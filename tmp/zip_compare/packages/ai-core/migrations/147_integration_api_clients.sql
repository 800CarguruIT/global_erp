CREATE TABLE IF NOT EXISTS integration_api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_secret_hash text NOT NULL,
  company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_api_clients_company
  ON integration_api_clients (company_id);

CREATE INDEX IF NOT EXISTS idx_integration_api_clients_active
  ON integration_api_clients (is_active);
