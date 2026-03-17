-- Calls table for global/companies/branches to track inbound/outbound activity
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global', -- global | company | branch | vendor
  company_id UUID NULL,
  branch_id UUID NULL,
  direction TEXT NULL, -- inbound | outbound
  status TEXT NULL, -- completed | failed | missed | in-progress
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS calls_started_at_idx ON calls (started_at DESC);
CREATE INDEX IF NOT EXISTS calls_scope_idx ON calls (scope, company_id, branch_id);
