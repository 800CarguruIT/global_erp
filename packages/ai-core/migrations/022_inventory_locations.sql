-- 022_inventory_locations.sql
-- Company inventory locations: warehouses, branches, fleet vans, etc.

CREATE TABLE IF NOT EXISTS inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- Short code like "WH-01", "BR-DXB", "VAN-01"
    code TEXT NOT NULL,
    -- Human readable name
    name TEXT NOT NULL,

    -- 'branch' | 'warehouse' | 'fleet_vehicle' | 'other'
    location_type TEXT NOT NULL,

    branch_id UUID NULL,
    fleet_vehicle_id UUID NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure one code per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_locations_company_code
    ON inventory_locations(company_id, code);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_company_type
    ON inventory_locations(company_id, location_type);

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION trg_touch_inventory_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inventory_locations_updated_at
    ON inventory_locations;

CREATE TRIGGER trg_touch_inventory_locations_updated_at
    BEFORE UPDATE ON inventory_locations
    FOR EACH ROW
    EXECUTE FUNCTION trg_touch_inventory_locations_updated_at();
