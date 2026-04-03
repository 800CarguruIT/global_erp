-- Public share tokens for leads (recovery requests, RSA jobs, etc.)
CREATE TABLE IF NOT EXISTS lead_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by_user_id uuid NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_share_tokens_token ON lead_share_tokens (token);
CREATE INDEX IF NOT EXISTS idx_lead_share_tokens_lead ON lead_share_tokens (company_id, lead_id);