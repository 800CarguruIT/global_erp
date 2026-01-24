-- 086_accounting_accounts.sql

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading_id uuid NOT NULL REFERENCES accounting_headings(id) ON DELETE CASCADE,
  subheading_id uuid NOT NULL REFERENCES accounting_subheadings(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES accounting_groups(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text NOT NULL,
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
  ADD COLUMN IF NOT EXISTS account_code text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_group_code
ON accounting_accounts (group_id, account_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_company_code
ON accounting_accounts (company_id, account_code);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_company
ON accounting_accounts (company_id);

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
