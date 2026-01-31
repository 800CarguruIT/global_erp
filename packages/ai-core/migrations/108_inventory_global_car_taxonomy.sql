-- Allow global (company-agnostic) car makes/models/years

ALTER TABLE inventory_car_makes
  ALTER COLUMN company_id DROP NOT NULL,
  ALTER COLUMN subcategory_id DROP NOT NULL;

ALTER TABLE inventory_car_models
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE inventory_model_years
  ALTER COLUMN company_id DROP NOT NULL;
