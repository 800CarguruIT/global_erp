-- 169_inspection_ai_fields.sql
-- Add AI-related fields to inspections and line_items for smart inspection flow

-- Cache VIN decode result on inspection
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS vin_decode_result JSONB NULL;

-- Structured category links + AI data on line items
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS category_id UUID NULL;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS subcategory_id UUID NULL;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS part_definition_id UUID NULL;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS severity_level TEXT NULL;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS ai_part_number TEXT NULL;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS ai_part_alternatives JSONB NULL;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS ai_price_estimate JSONB NULL;
