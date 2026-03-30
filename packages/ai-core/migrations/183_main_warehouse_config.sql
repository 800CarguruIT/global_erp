-- 183_main_warehouse_config.sql
-- Add main warehouse location configuration

-- Add column to track default warehouse per company
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS main_warehouse_location_id uuid NULL;

-- Auto-set main warehouse for existing companies that have a warehouse location
UPDATE companies c
SET main_warehouse_location_id = (
  SELECT il.id FROM inventory_locations il
  WHERE il.company_id = c.id
    AND il.location_type = 'warehouse'
    AND il.branch_id IS NULL
    AND il.is_active = TRUE
  ORDER BY il.created_at ASC
  LIMIT 1
)
WHERE c.main_warehouse_location_id IS NULL;
