-- 023_fleet_and_bays.sql

-- Fleet vehicles per branch
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  vehicle_type text NOT NULL,
  plate_number text NULL,
  make text NULL,
  model text NULL,
  model_year integer NULL,
  capacity_jobs integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'available',
  is_active boolean NOT NULL DEFAULT true,
  inventory_location_id uuid NULL REFERENCES inventory_locations(id),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_company_branch ON fleet_vehicles(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_fleet_company_status ON fleet_vehicles(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_company_code ON fleet_vehicles(company_id, code);

-- Workshop bays per branch
CREATE TABLE IF NOT EXISTS workshop_bays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  bay_type text NOT NULL DEFAULT 'mechanical',
  capacity_cars integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'available',
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bays_company_branch ON workshop_bays(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_bays_company_status ON workshop_bays(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bays_company_code ON workshop_bays(company_id, code);

-- touch triggers for updated_at
CREATE OR REPLACE FUNCTION touch_fleet_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_fleet_vehicles_updated_at ON fleet_vehicles;
CREATE TRIGGER trg_touch_fleet_vehicles_updated_at
BEFORE UPDATE ON fleet_vehicles
FOR EACH ROW EXECUTE FUNCTION touch_fleet_vehicles_updated_at();

CREATE OR REPLACE FUNCTION touch_workshop_bays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_workshop_bays_updated_at ON workshop_bays;
CREATE TRIGGER trg_touch_workshop_bays_updated_at
BEFORE UPDATE ON workshop_bays
FOR EACH ROW EXECUTE FUNCTION touch_workshop_bays_updated_at();
