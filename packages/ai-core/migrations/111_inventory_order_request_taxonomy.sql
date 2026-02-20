-- Add taxonomy references to inventory order request items
BEGIN;

ALTER TABLE inventory_order_request_items
  ADD COLUMN IF NOT EXISTS inventory_type_id uuid NULL REFERENCES inventory_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid NULL REFERENCES inventory_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid NULL REFERENCES inventory_subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS make_id uuid NULL REFERENCES inventory_car_makes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_id uuid NULL REFERENCES inventory_car_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year_id uuid NULL REFERENCES inventory_model_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inv_request_items_type ON inventory_order_request_items (inventory_type_id);
CREATE INDEX IF NOT EXISTS idx_inv_request_items_category ON inventory_order_request_items (category_id);
CREATE INDEX IF NOT EXISTS idx_inv_request_items_subcategory ON inventory_order_request_items (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_inv_request_items_make ON inventory_order_request_items (make_id);
CREATE INDEX IF NOT EXISTS idx_inv_request_items_model ON inventory_order_request_items (model_id);
CREATE INDEX IF NOT EXISTS idx_inv_request_items_year ON inventory_order_request_items (year_id);

COMMIT;
