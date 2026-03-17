-- CHSC service contracts (multi-company)
-- Normalized model for package master, contract headers, benefits, and service entitlements.

CREATE TABLE IF NOT EXISTS service_contract_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  legacy_package_id bigint NULL,
  code text NOT NULL,
  name text NOT NULL,
  plan_type text NULL,
  cylinder integer NULL,
  mileage_limit integer NULL,
  minor_count integer NOT NULL DEFAULT 0,
  major_count integer NOT NULL DEFAULT 0,
  base_price numeric(14,2) NOT NULL DEFAULT 0,
  solo_count numeric(10,2) NULL,
  terms text NULL,
  description_html text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_contract_packages_company_code
  ON service_contract_packages (company_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_contract_packages_company_legacy
  ON service_contract_packages (company_id, legacy_package_id)
  WHERE legacy_package_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_contract_packages_company
  ON service_contract_packages (company_id);

CREATE TABLE IF NOT EXISTS service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL,
  customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL,
  car_id uuid NULL REFERENCES cars(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  invoice_id uuid NULL REFERENCES invoices(id) ON DELETE SET NULL,
  package_id uuid NOT NULL REFERENCES service_contract_packages(id) ON DELETE RESTRICT,
  legacy_chsc_customer_id bigint NULL,
  legacy_account_id bigint NULL,
  legacy_car_id bigint NULL,
  legacy_lead_id bigint NULL,
  legacy_invoice_id bigint NULL,
  contract_type text NOT NULL DEFAULT 'upgrade',
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('draft', 'active', 'suspended', 'cancelled', 'expired', 'completed', 'renewed')
  ),
  chsc_status text NULL,
  active boolean NOT NULL DEFAULT true,
  package_summary text NULL,
  minor_quota integer NOT NULL DEFAULT 0,
  major_quota integer NOT NULL DEFAULT 0,
  package_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  final_amount numeric(14,2) NOT NULL DEFAULT 0,
  sold_at timestamptz NULL,
  payment_mode text NULL,
  advisor_name text NULL,
  region text NULL,
  car_plate text NULL,
  customer_status text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_contracts_company_legacy
  ON service_contracts (company_id, legacy_chsc_customer_id)
  WHERE legacy_chsc_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_contracts_company
  ON service_contracts (company_id);

CREATE INDEX IF NOT EXISTS idx_service_contracts_company_customer
  ON service_contracts (company_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_service_contracts_company_car
  ON service_contracts (company_id, car_id);

CREATE INDEX IF NOT EXISTS idx_service_contracts_company_status
  ON service_contracts (company_id, status);

CREATE TABLE IF NOT EXISTS service_contract_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  benefit_type text NOT NULL,
  product_id text NULL,
  benefit_value numeric(14,2) NOT NULL DEFAULT 0,
  description text NULL,
  is_redeemed boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_contract_benefits_company
  ON service_contract_benefits (company_id);

CREATE INDEX IF NOT EXISTS idx_service_contract_benefits_contract
  ON service_contract_benefits (contract_id);

CREATE TABLE IF NOT EXISTS service_contract_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  service_kind text NOT NULL CHECK (service_kind IN ('minor', 'major')),
  sequence_no integer NOT NULL,
  planned_mileage integer NULL,
  planned_date date NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'expired', 'cancelled')),
  consumed_mileage integer NULL,
  consumed_at date NULL,
  legacy_service_id bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_contract_entitlements_company_legacy
  ON service_contract_entitlements (company_id, legacy_service_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_contract_entitlements_contract_seq
  ON service_contract_entitlements (contract_id, service_kind, sequence_no);

CREATE INDEX IF NOT EXISTS idx_service_contract_entitlements_company
  ON service_contract_entitlements (company_id);

CREATE INDEX IF NOT EXISTS idx_service_contract_entitlements_contract
  ON service_contract_entitlements (contract_id);

-- Touch trigger for updated_at
CREATE OR REPLACE FUNCTION touch_service_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_service_contract_packages_updated_at ON service_contract_packages;
CREATE TRIGGER trg_touch_service_contract_packages_updated_at
BEFORE UPDATE ON service_contract_packages
FOR EACH ROW
EXECUTE FUNCTION touch_service_contracts_updated_at();

DROP TRIGGER IF EXISTS trg_touch_service_contracts_updated_at ON service_contracts;
CREATE TRIGGER trg_touch_service_contracts_updated_at
BEFORE UPDATE ON service_contracts
FOR EACH ROW
EXECUTE FUNCTION touch_service_contracts_updated_at();

DROP TRIGGER IF EXISTS trg_touch_service_contract_benefits_updated_at ON service_contract_benefits;
CREATE TRIGGER trg_touch_service_contract_benefits_updated_at
BEFORE UPDATE ON service_contract_benefits
FOR EACH ROW
EXECUTE FUNCTION touch_service_contracts_updated_at();

DROP TRIGGER IF EXISTS trg_touch_service_contract_entitlements_updated_at ON service_contract_entitlements;
CREATE TRIGGER trg_touch_service_contract_entitlements_updated_at
BEFORE UPDATE ON service_contract_entitlements
FOR EACH ROW
EXECUTE FUNCTION touch_service_contracts_updated_at();
