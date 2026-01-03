-- 047_push_device_tokens.sql
-- Store FCM device tokens for push notifications (global/company scope)

CREATE TABLE IF NOT EXISTS push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'company')),
  company_id uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  device_token text NOT NULL,
  platform text NULL,
  device_id text NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_device_tokens_token
  ON push_device_tokens (device_token);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_scope_company
  ON push_device_tokens (scope, company_id);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user
  ON push_device_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_active
  ON push_device_tokens (is_active);
