-- 166_vin_catalog_parts_extra.sql
-- Add diagram_url and name_zh columns to vin_catalog_parts for richer part data.

ALTER TABLE vin_catalog_parts
  ADD COLUMN IF NOT EXISTS diagram_url text,
  ADD COLUMN IF NOT EXISTS name_zh text,
  ADD COLUMN IF NOT EXISTS name_translated boolean NOT NULL DEFAULT false;
