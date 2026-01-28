-- 103_inventory_transfer_orders.sql
BEGIN;

-- Parts catalog (master SKU definitions)
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

-- Inventory locations (central/branch/fleet/warehouse)
CREATE TABLE IF NOT EXISTS inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL,
  parent_location_id uuid NULL REFERENCES inventory_locations(id),
  branch_id uuid NULL,
  fleet_vehicle_id uuid NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_locations_company_code ON inventory_locations(company_id, code);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_company_type ON inventory_locations(company_id, location_type);

-- Inventory stock aggregated per SKU + location
CREATE TABLE IF NOT EXISTS inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL REFERENCES parts_catalog(id) ON DELETE RESTRICT,
  location_code text NOT NULL DEFAULT 'MAIN',
  on_hand numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, part_id, location_code),
  CONSTRAINT inventory_stock_location_company_fk FOREIGN KEY (company_id, location_code)
    REFERENCES inventory_locations(company_id, code)
);

-- Transfer orders for moving stock between locations
CREATE TABLE IF NOT EXISTS inventory_transfer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  transfer_number text NOT NULL,
  from_location_id uuid NOT NULL REFERENCES inventory_locations(id),
  to_location_id uuid NOT NULL REFERENCES inventory_locations(id),
  status text NOT NULL DEFAULT 'draft',
  notes text NULL,
  created_by uuid NULL,
  completed_by uuid NULL,
  dispatched_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, transfer_number),
  CHECK (status IN ('draft', 'in_transit', 'completed', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_orders_company_locations
  ON inventory_transfer_orders(company_id, from_location_id, to_location_id);

-- Transfer line items
CREATE TABLE IF NOT EXISTS inventory_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES inventory_transfer_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  parts_catalog_id uuid NOT NULL REFERENCES parts_catalog(id),
  line_no integer NOT NULL,
  quantity numeric(14,2) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_company ON inventory_transfer_items(company_id);

-- Stock movements (audit trail)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL REFERENCES parts_catalog(id),
  location_id uuid NULL REFERENCES inventory_locations(id),
  location_code text NOT NULL DEFAULT 'MAIN',
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  quantity numeric(14,2) NOT NULL,
  source_type text NOT NULL,
  source_id uuid NULL,
  transfer_id uuid NULL REFERENCES inventory_transfer_orders(id),
  grn_number text NULL,
  note text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company ON inventory_movements(company_id);

-- Trigger helpers
CREATE OR REPLACE FUNCTION trg_touch_inventory_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_locations_updated_at ON inventory_locations;
CREATE TRIGGER trg_touch_inventory_locations_updated_at
  BEFORE UPDATE ON inventory_locations
  FOR EACH ROW
  EXECUTE FUNCTION trg_touch_inventory_locations_updated_at();

CREATE OR REPLACE FUNCTION trg_touch_inventory_transfer_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_transfer_orders_updated_at ON inventory_transfer_orders;
CREATE TRIGGER trg_touch_inventory_transfer_orders_updated_at
  BEFORE UPDATE ON inventory_transfer_orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_touch_inventory_transfer_orders_updated_at();

CREATE OR REPLACE FUNCTION trg_inventory_transfer_orders_company_check()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM inventory_locations
    WHERE id = NEW.from_location_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'from_location % is not owned by company %', NEW.from_location_id, NEW.company_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM inventory_locations
    WHERE id = NEW.to_location_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'to_location % is not owned by company %', NEW.to_location_id, NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_transfer_orders_company_check ON inventory_transfer_orders;
CREATE TRIGGER trg_inventory_transfer_orders_company_check
  BEFORE INSERT OR UPDATE ON inventory_transfer_orders
  FOR EACH ROW EXECUTE FUNCTION trg_inventory_transfer_orders_company_check();

CREATE OR REPLACE FUNCTION trg_inventory_transfer_items_company_check()
RETURNS TRIGGER AS $$
DECLARE
  owner_company uuid;
BEGIN
  SELECT company_id INTO owner_company FROM inventory_transfer_orders WHERE id = NEW.transfer_id;
  IF owner_company IS NULL OR owner_company <> NEW.company_id THEN
    RAISE EXCEPTION 'item company % must match transfer order company %', NEW.company_id, owner_company;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_transfer_items_company_check ON inventory_transfer_items;
CREATE TRIGGER trg_inventory_transfer_items_company_check
  BEFORE INSERT OR UPDATE ON inventory_transfer_items
  FOR EACH ROW EXECUTE FUNCTION trg_inventory_transfer_items_company_check();

CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_existing inventory_stock%ROWTYPE;
  delta numeric(14,2);
BEGIN
  delta := CASE WHEN NEW.direction = 'in' THEN NEW.quantity ELSE -NEW.quantity END;

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
      delta
    );
  ELSE
    UPDATE inventory_stock
    SET on_hand = v_existing.on_hand + delta,
        updated_at = now()
    WHERE id = v_existing.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION apply_inventory_movement();

COMMIT;
