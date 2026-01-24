-- Add VIN photo file reference for cars
ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS vin_photo_file_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_cars_vin_photo_file ON cars(vin_photo_file_id);
