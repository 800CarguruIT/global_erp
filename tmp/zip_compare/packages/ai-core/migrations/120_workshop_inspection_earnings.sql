-- 120_workshop_inspection_earnings.sql
-- Company-level inspection cost settings + earnings/fines snapshots for verified inspections.

CREATE TABLE IF NOT EXISTS workshop_company_cost_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  inspection_fixed_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  vat_rate numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspection_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  lead_id uuid NULL,
  branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  fine_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_before_vat numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(6,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_payable numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'locked', -- locked | posted | paid
  verified_by uuid NULL REFERENCES users(id),
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_inspection_earnings_inspection UNIQUE (inspection_id)
);

CREATE TABLE IF NOT EXISTS inspection_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  fine_code text NULL,
  reason text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_earnings_company_branch
  ON inspection_earnings (company_id, branch_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspection_fines_company_inspection
  ON inspection_fines (company_id, inspection_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_workshop_company_cost_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_workshop_company_cost_settings_updated_at ON workshop_company_cost_settings;
CREATE TRIGGER trg_touch_workshop_company_cost_settings_updated_at
BEFORE UPDATE ON workshop_company_cost_settings
FOR EACH ROW EXECUTE FUNCTION touch_workshop_company_cost_settings_updated_at();

CREATE OR REPLACE FUNCTION touch_inspection_earnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inspection_earnings_updated_at ON inspection_earnings;
CREATE TRIGGER trg_touch_inspection_earnings_updated_at
BEFORE UPDATE ON inspection_earnings
FOR EACH ROW EXECUTE FUNCTION touch_inspection_earnings_updated_at();

CREATE OR REPLACE FUNCTION touch_inspection_fines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inspection_fines_updated_at ON inspection_fines;
CREATE TRIGGER trg_touch_inspection_fines_updated_at
BEFORE UPDATE ON inspection_fines
FOR EACH ROW EXECUTE FUNCTION touch_inspection_fines_updated_at();
