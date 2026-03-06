-- 086_accounting_accounts.sql

-- Ensure accounting_entities exists for FK references in this migration.
CREATE TABLE IF NOT EXISTS accounting_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','company')),
  company_id uuid NULL REFERENCES companies(id),
  name text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_entities_scope_company
ON accounting_entities (scope, company_id);

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading_id uuid NOT NULL REFERENCES accounting_headings(id) ON DELETE CASCADE,
  subheading_id uuid NOT NULL REFERENCES accounting_subheadings(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES accounting_groups(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_id uuid NULL REFERENCES accounting_entities(id) ON DELETE CASCADE,
  standard_id uuid NULL,
  account_code text NOT NULL,
  account_name text NOT NULL,
  code text NULL,
  name text NULL,
  type text NULL,
  sub_type text NULL,
  normal_balance text NULL,
  parent_id uuid NULL,
  is_leaf boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure columns exist if the table was created by older migrations
ALTER TABLE IF EXISTS accounting_accounts
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES accounting_entities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS heading_id uuid REFERENCES accounting_headings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subheading_id uuid REFERENCES accounting_subheadings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES accounting_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS standard_id uuid,
  ADD COLUMN IF NOT EXISTS account_code text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS sub_type text,
  ADD COLUMN IF NOT EXISTS normal_balance text,
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS is_leaf boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_group_code
ON accounting_accounts (group_id, account_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_company_code
ON accounting_accounts (company_id, account_code);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_company
ON accounting_accounts (company_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_entity_code
ON accounting_accounts (entity_id, code);

CREATE OR REPLACE FUNCTION touch_accounting_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_accounting_accounts_updated_at ON accounting_accounts;
CREATE TRIGGER trg_touch_accounting_accounts_updated_at
BEFORE UPDATE ON accounting_accounts
FOR EACH ROW EXECUTE FUNCTION touch_accounting_accounts_updated_at();
