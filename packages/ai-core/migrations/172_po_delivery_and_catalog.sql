-- 172_po_delivery_and_catalog.sql
-- PO delivery phase fields, vendor evidence, and self-building parts catalog

-- PO delivery phase
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_branch_id UUID NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_contact TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_phone TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_set_at TIMESTAMPTZ NULL;

-- Vendor evidence per PO item
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS vendor_part_number TEXT NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS vendor_part_brand TEXT NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS vendor_part_photo_file_id UUID NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS vendor_evidence_at TIMESTAMPTZ NULL;

-- AI suggested part number on quotes
ALTER TABLE part_quotes ADD COLUMN IF NOT EXISTS ai_suggested_part_number TEXT NULL;

-- Self-building verified parts catalog
CREATE TABLE IF NOT EXISTS verified_parts_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  car_make TEXT NOT NULL,
  car_model TEXT NULL,
  car_year INTEGER NULL,
  vin TEXT NULL,
  part_name TEXT NOT NULL,
  part_category TEXT NULL,
  confirmed_part_number TEXT NOT NULL,
  confirmed_brand TEXT NULL,
  part_photo_file_id UUID NULL,
  source_po_id UUID NULL,
  source_vendor_id UUID NULL,
  ai_suggested_part_number TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vpc_lookup ON verified_parts_catalog (company_id, car_make, part_name);
CREATE INDEX IF NOT EXISTS idx_vpc_part_number ON verified_parts_catalog (company_id, confirmed_part_number);
