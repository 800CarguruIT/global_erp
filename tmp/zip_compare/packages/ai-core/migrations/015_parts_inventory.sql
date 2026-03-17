-- 015_parts_inventory.sql

-- Extend estimate_items with part procurement fields
ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS is_part boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS part_number text NULL,
  ADD COLUMN IF NOT EXISTS part_brand text NULL,
  ADD COLUMN IF NOT EXISTS part_sku text NULL,
  ADD COLUMN IF NOT EXISTS procurement_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ordered_qty numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_qty numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_qty numeric(10,2) NOT NULL DEFAULT 0;

-- Parts catalog
CREATE TABLE IF NOT EXISTS parts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_number text NOT NULL,
  brand text NOT NULL,
  sku text NOT NULL,
  description text NULL,
  qr_code text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, part_number, brand)
);

-- Inventory stock by location
CREATE TABLE IF NOT EXISTS inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL REFERENCES parts_catalog(id) ON DELETE RESTRICT,
  location_code text NOT NULL DEFAULT 'MAIN',
  on_hand numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, part_id, location_code)
);

-- Inventory movements (in/out)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL REFERENCES parts_catalog(id),
  location_code text NOT NULL DEFAULT 'MAIN',
  direction text NOT NULL, -- 'in' | 'out'
  quantity numeric(14,2) NOT NULL,
  source_type text NOT NULL, -- po | adjustment | issue | receipt etc.
  source_id uuid NULL,
  grn_number text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to keep inventory_stock in sync
CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_existing inventory_stock%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM inventory_stock
  WHERE company_id = NEW.company_id
    AND part_id = NEW.part_id
    AND location_code = NEW.location_code
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO inventory_stock (
      company_id,
      part_id,
      location_code,
      on_hand
    ) VALUES (
      NEW.company_id,
      NEW.part_id,
      NEW.location_code,
      CASE WHEN NEW.direction = 'in' THEN NEW.quantity ELSE -NEW.quantity END
    );
  ELSE
    UPDATE inventory_stock
    SET on_hand = v_existing.on_hand +
      CASE WHEN NEW.direction = 'in' THEN NEW.quantity ELSE -NEW.quantity END,
        updated_at = now()
    WHERE id = v_existing.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();
