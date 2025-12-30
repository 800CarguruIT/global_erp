-- Branches table to support branch-scoped data
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  address_line1 text NULL,
  address_line2 text NULL,
  city text NULL,
  state_region text NULL,
  postal_code text NULL,
  country text NULL,
  phone text NULL,
  email text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_company_code
  ON branches (company_id, code);

CREATE INDEX IF NOT EXISTS idx_branches_company
  ON branches (company_id);

-- Touch trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_touch_branches_updated_at ON branches;
DROP FUNCTION IF EXISTS touch_branches_updated_at();

CREATE OR REPLACE FUNCTION touch_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION touch_branches_updated_at();
