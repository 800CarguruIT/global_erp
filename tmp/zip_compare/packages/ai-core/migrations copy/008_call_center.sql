-- 008_call_center.sql
-- Call Center tables for call sessions and recordings

CREATE TABLE IF NOT EXISTS call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL, -- 'global' | 'company'
  company_id uuid NULL,
  branch_id uuid NULL,
  created_by_user_id uuid NOT NULL,
  direction text NOT NULL, -- 'outbound' | 'inbound'
  from_number text NOT NULL,
  to_number text NOT NULL,
  to_entity_type text NULL, -- 'customer' | 'employee' | 'vendor' | 'other'
  to_entity_id uuid NULL,
  provider_key text NOT NULL,
  provider_call_id text NULL,
  status text NOT NULL, -- 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  duration_seconds integer NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_scope_company_branch ON call_sessions (scope, company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_created_by ON call_sessions (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_entity ON call_sessions (to_entity_type, to_entity_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_provider_call ON call_sessions (provider_call_id);

CREATE TABLE IF NOT EXISTS call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  provider_recording_id text NOT NULL,
  url text NOT NULL,
  duration_seconds integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_recordings_session ON call_recordings (call_session_id);
