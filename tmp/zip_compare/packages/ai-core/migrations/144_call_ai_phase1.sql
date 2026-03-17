-- Phase 1: inbound call AI policy (dry-run) per company

CREATE TABLE IF NOT EXISTS company_call_ai_policy (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'dry_run', -- dry_run | live
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  business_hours jsonb NOT NULL DEFAULT '{"enabled":false,"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  restrictions jsonb NOT NULL DEFAULT '{"blockUnknownNumbers":false,"blockedPrefixes":[],"allowedPrefixes":[]}'::jsonb,
  guidance jsonb NOT NULL DEFAULT '{"welcomeMessage":"","systemPrompt":"","escalationKeywords":[]}'::jsonb,
  updated_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_ai_policy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  provider_key text NOT NULL,
  provider_call_id text NOT NULL,
  from_number text NULL,
  to_number text NULL,
  decision text NOT NULL, -- disabled | allow_ai | block | escalate | no_company
  reason text NOT NULL,
  mode text NOT NULL DEFAULT 'dry_run',
  matched_rule text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_ai_policy_decisions_company_created
  ON call_ai_policy_decisions (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_ai_policy_decisions_provider_call
  ON call_ai_policy_decisions (provider_key, provider_call_id, created_at DESC);
