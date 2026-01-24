-- 030_branch_extensions.sql
-- Extend branches with ownership/type/trade license and add contacts/bank accounts

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS display_name text NULL,
  ADD COLUMN IF NOT EXISTS legal_name text NULL,
  ADD COLUMN IF NOT EXISTS ownership_type text NULL,
  ADD COLUMN IF NOT EXISTS branch_types text[] NULL,
  ADD COLUMN IF NOT EXISTS service_types text[] NULL,
  ADD COLUMN IF NOT EXISTS phone_code text NULL,
  ADD COLUMN IF NOT EXISTS trade_license_number text NULL,
  ADD COLUMN IF NOT EXISTS trade_license_issue text NULL,
  ADD COLUMN IF NOT EXISTS trade_license_expiry text NULL,
  ADD COLUMN IF NOT EXISTS trade_license_file_id text NULL;
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS allow_branch_invoicing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_certificate_file_id text NULL,
  ADD COLUMN IF NOT EXISTS trn_number text NULL;

CREATE TABLE IF NOT EXISTS branch_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_code text NULL,
  phone_number text NULL,
  email text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_contacts_branch ON branch_contacts(branch_id);

CREATE TABLE IF NOT EXISTS branch_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  bank_name text NULL,
  branch_name text NULL,
  account_name text NULL,
  account_number text NULL,
  iban text NULL,
  swift text NULL,
  currency text NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_bank_accounts_branch ON branch_bank_accounts(branch_id);
