-- 161_part_quote_option_brands.sql
-- Store brand per quote option type.

ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS oem_brand text NULL,
  ADD COLUMN IF NOT EXISTS oe_brand text NULL,
  ADD COLUMN IF NOT EXISTS aftm_brand text NULL,
  ADD COLUMN IF NOT EXISTS used_brand text NULL;

