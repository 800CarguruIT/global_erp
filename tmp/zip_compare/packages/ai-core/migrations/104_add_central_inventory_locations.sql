-- 104_add_central_inventory_locations.sql
BEGIN;

-- Ensure every company gets a central warehouse inventory location so inventory can be tracked from day one.
INSERT INTO inventory_locations (company_id, code, name, location_type, is_active)
SELECT
  c.id,
  'MAIN',
  'Central Warehouse',
  'warehouse',
  TRUE
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_locations l
  WHERE l.company_id = c.id AND l.code = 'MAIN'
);

COMMIT;
