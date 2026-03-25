-- 165_vin_catalog_cars_epc.sql
-- Add epc column to vin_catalog_cars for persistent EPC lookup without re-decoding.

ALTER TABLE vin_catalog_cars
  ADD COLUMN IF NOT EXISTS epc text;
