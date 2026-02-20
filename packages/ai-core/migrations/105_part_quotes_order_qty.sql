-- 105_part_quotes_order_qty.sql
-- Track ordered quantities by type on part quotes.

ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS ordered_oem_qty numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS ordered_oe_qty numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS ordered_aftm_qty numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS ordered_used_qty numeric(10,2) NULL;
