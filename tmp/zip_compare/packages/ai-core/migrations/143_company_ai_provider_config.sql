-- Per-company OpenAI provider configuration
CREATE TABLE IF NOT EXISTS company_ai_provider_config (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai',
  base_url text NULL,
  api_key text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_ai_provider_config_provider
  ON company_ai_provider_config (provider);
