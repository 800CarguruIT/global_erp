-- 102_drop_inventory_schema.sql
BEGIN;

-- drop triggers/functions
DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON inventory_movements;
DROP FUNCTION IF EXISTS apply_inventory_movement();
DROP TRIGGER IF EXISTS trg_touch_inventory_locations_updated_at ON inventory_locations;
DROP FUNCTION IF EXISTS trg_touch_inventory_locations_updated_at();
DROP TRIGGER IF EXISTS trg_touch_inventory_transfer_orders_updated_at ON inventory_transfer_orders;
DROP FUNCTION IF EXISTS trg_touch_inventory_transfer_orders_updated_at();
DROP TRIGGER IF EXISTS trg_inventory_transfer_orders_company_check ON inventory_transfer_orders;
DROP FUNCTION IF EXISTS trg_inventory_transfer_orders_company_check();
DROP TRIGGER IF EXISTS trg_inventory_transfer_items_company_check ON inventory_transfer_items;
DROP FUNCTION IF EXISTS trg_inventory_transfer_items_company_check();

-- drop inventory tables (order matters because of FKs)
ALTER TABLE IF EXISTS fleet_vehicles DROP CONSTRAINT IF EXISTS fleet_vehicles_inventory_location_id_fkey;
ALTER TABLE IF EXISTS accounting_company_settings DROP COLUMN IF EXISTS inventory_account_id;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS transfer_id;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS purchase_order_id;

DROP TABLE IF EXISTS inventory_transfer_items;
DROP TABLE IF EXISTS inventory_transfer_orders;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS inventory_stock;
DROP TABLE IF EXISTS inventory_locations;
DROP TABLE IF EXISTS parts_catalog;

COMMIT;
