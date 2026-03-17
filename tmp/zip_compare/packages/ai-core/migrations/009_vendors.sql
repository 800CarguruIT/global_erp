-- 009_vendors.sql
-- Vendor master data (company-scoped)

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  code text NOT NULL,
  name text NOT NULL,
  legal_name text NULL,

  phone text NULL,
  email text NULL,

  address_line1 text NULL,
  address_line2 text NULL,
  city text NULL,
  state_region text NULL,
  postal_code text NULL,
  country text NULL,

  trade_license_number text NULL,
  trade_license_issue date NULL,
  trade_license_expiry date NULL,
  trade_license_file_id uuid NULL,

  tax_number text NULL,
  tax_certificate_file_id uuid NULL,

  is_active boolean NOT NULL DEFAULT TRUE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_company_code
  ON vendors(company_id, code);

CREATE INDEX IF NOT EXISTS idx_vendors_company_active
  ON vendors(company_id, is_active);

CREATE TABLE IF NOT EXISTS vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  name text NOT NULL,
  phone text NULL,
  email text NULL,
  address text NULL,

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor
  ON vendor_contacts(vendor_id);

CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  bank_name text NULL,
  branch_name text NULL,
  account_name text NULL,
  account_number text NULL,
  iban text NULL,
  swift text NULL,
  currency text NULL,

  is_default boolean NOT NULL DEFAULT FALSE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_vendor
  ON vendor_bank_accounts(vendor_id);
