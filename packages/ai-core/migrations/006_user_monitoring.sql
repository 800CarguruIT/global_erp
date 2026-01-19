-- User monitoring: sessions, activity, change history, risk
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  scope text NOT NULL,
  company_id uuid NULL,
  branch_id uuid NULL,
  vendor_id uuid NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_address text NULL,
  user_agent text NULL,
  device_fingerprint text NULL,
  geo_country text NULL,
  geo_city text NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_action text NULL,
  last_action_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_scope ON user_sessions (scope, company_id, branch_id, vendor_id);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  session_id uuid NULL REFERENCES user_sessions(id),
  scope text NOT NULL,
  company_id uuid NULL,
  branch_id uuid NULL,
  vendor_id uuid NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  ip_address text NULL,
  action_key text NOT NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  summary text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_ts ON user_activity_logs (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activity_action_ts ON user_activity_logs (action_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activity_scope ON user_activity_logs (scope, company_id, branch_id, vendor_id);

CREATE TABLE IF NOT EXISTS user_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES users(id),
  session_id uuid NULL REFERENCES user_sessions(id),
  scope text NOT NULL,
  company_id uuid NULL,
  branch_id uuid NULL,
  vendor_id uuid NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  change_timestamp timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL,
  change_summary text NULL,
  before_data jsonb NULL,
  after_data jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_user_change_entity_ts ON user_change_history (entity_type, entity_id, change_timestamp);
CREATE INDEX IF NOT EXISTS idx_user_change_user_ts ON user_change_history (user_id, change_timestamp);

CREATE TABLE IF NOT EXISTS user_risk_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  overall_risk_score numeric(5,2) NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  has_global_admin_role boolean NOT NULL DEFAULT false,
  high_privilege_role_count integer NOT NULL DEFAULT 0,
  total_active_sessions integer NOT NULL DEFAULT 0,
  last_login_at timestamptz NULL,
  last_login_ip text NULL,
  last_login_country text NULL,
  last_failed_login_at timestamptz NULL,
  unusual_location boolean NOT NULL DEFAULT false,
  notes text NULL
);

-- Permissions for monitoring
INSERT INTO permissions (key, description)
VALUES
  ('monitoring.view', 'View user monitoring data'),
  ('monitoring.manage', 'Manage user monitoring')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  rid uuid;
BEGIN
  SELECT id INTO rid FROM roles WHERE key = 'global_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions WHERE key IN ('monitoring.view','monitoring.manage')
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO rid FROM roles WHERE key = 'company_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions WHERE key IN ('monitoring.view')
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
