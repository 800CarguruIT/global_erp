-- Inventory taxonomy: inventory types (company scoped)

CREATE TABLE IF NOT EXISTS inventory_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_types_company_code
  ON inventory_types (company_id, code);

CREATE INDEX IF NOT EXISTS idx_inventory_types_company_name
  ON inventory_types (company_id, name);

CREATE OR REPLACE FUNCTION touch_inventory_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_types_updated_at ON inventory_types;
CREATE TRIGGER trg_touch_inventory_types_updated_at
BEFORE UPDATE ON inventory_types
FOR EACH ROW EXECUTE FUNCTION touch_inventory_types_updated_at();
