-- Inventory taxonomy hierarchy (categories -> subcategories -> make -> model -> year -> parts)

CREATE TABLE IF NOT EXISTS inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  inventory_type_id uuid NOT NULL REFERENCES inventory_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_car_makes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  subcategory_id uuid NOT NULL REFERENCES inventory_subcategories(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_car_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  make_id uuid NOT NULL REFERENCES inventory_car_makes(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_model_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  model_id uuid NOT NULL REFERENCES inventory_car_models(id) ON DELETE CASCADE,
  year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  year_id uuid NOT NULL REFERENCES inventory_model_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  part_type text NULL,
  part_number text NOT NULL,
  part_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_company_type
  ON inventory_categories (company_id, inventory_type_id);
CREATE INDEX IF NOT EXISTS idx_inventory_subcategories_company_category
  ON inventory_subcategories (company_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_makes_company_subcategory
  ON inventory_car_makes (company_id, subcategory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_models_company_make
  ON inventory_car_models (company_id, make_id);
CREATE INDEX IF NOT EXISTS idx_inventory_years_company_model
  ON inventory_model_years (company_id, model_id);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_company_year
  ON inventory_parts (company_id, year_id);

CREATE OR REPLACE FUNCTION touch_inventory_taxonomy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_categories_updated_at ON inventory_categories;
CREATE TRIGGER trg_touch_inventory_categories_updated_at
BEFORE UPDATE ON inventory_categories
FOR EACH ROW EXECUTE FUNCTION touch_inventory_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trg_touch_inventory_subcategories_updated_at ON inventory_subcategories;
CREATE TRIGGER trg_touch_inventory_subcategories_updated_at
BEFORE UPDATE ON inventory_subcategories
FOR EACH ROW EXECUTE FUNCTION touch_inventory_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trg_touch_inventory_car_makes_updated_at ON inventory_car_makes;
CREATE TRIGGER trg_touch_inventory_car_makes_updated_at
BEFORE UPDATE ON inventory_car_makes
FOR EACH ROW EXECUTE FUNCTION touch_inventory_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trg_touch_inventory_car_models_updated_at ON inventory_car_models;
CREATE TRIGGER trg_touch_inventory_car_models_updated_at
BEFORE UPDATE ON inventory_car_models
FOR EACH ROW EXECUTE FUNCTION touch_inventory_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trg_touch_inventory_model_years_updated_at ON inventory_model_years;
CREATE TRIGGER trg_touch_inventory_model_years_updated_at
BEFORE UPDATE ON inventory_model_years
FOR EACH ROW EXECUTE FUNCTION touch_inventory_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trg_touch_inventory_parts_updated_at ON inventory_parts;
CREATE TRIGGER trg_touch_inventory_parts_updated_at
BEFORE UPDATE ON inventory_parts
FOR EACH ROW EXECUTE FUNCTION touch_inventory_taxonomy_updated_at();
