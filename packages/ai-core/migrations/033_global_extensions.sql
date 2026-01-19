-- 033_global_extensions.sql
-- Make leads usable for the global entity, add agent + subscription scaffolding,
-- and capture richer contact data without requiring a company/customer.

BEGIN;

-- Allow global (company-less) leads and events
ALTER TABLE leads
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE lead_events
  ALTER COLUMN company_id DROP NOT NULL;

-- Scope awareness for global flows
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'company'
    CHECK (scope IN ('company', 'global'));

ALTER TABLE lead_events
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'company'
    CHECK (scope IN ('company', 'global'));

CREATE INDEX IF NOT EXISTS idx_leads_scope ON leads(scope);
CREATE INDEX IF NOT EXISTS idx_lead_events_scope ON lead_events(scope);

-- Broaden lead types/statuses to support sales/support/complaint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_lead_type_check
  CHECK (lead_type IN ('rsa', 'recovery', 'workshop', 'sales', 'support', 'complaint'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_lead_status_check
  CHECK (
    lead_status IN (
      'open',
      'processing',
      'closed_won',
      'lost',
      'assigned',
      'onboarding',
      'inprocess',
      'completed',
      'closed'
    )
  );

-- Capture contact + address details directly on the lead (no customer required)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state_region text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone_code text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Track ownership/creator for assignment and audit
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(lead_owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by_user_id);

-- Agent registry (links user to an optional employee record)
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'agent',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);

-- Global subscriptions (categorised; amount wired later)
CREATE TABLE IF NOT EXISTS global_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('trial', 'active', 'expiring', 'expired', 'offboarded')),
  status text NOT NULL DEFAULT 'active',
  amount numeric(14,2),
  currency text NOT NULL DEFAULT 'USD',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  managed_by_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_subscriptions_category ON global_subscriptions(category);
CREATE INDEX IF NOT EXISTS idx_global_subscriptions_status ON global_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_global_subscriptions_company ON global_subscriptions(company_id);

COMMIT;
