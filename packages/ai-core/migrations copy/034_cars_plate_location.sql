-- Add plate metadata fields to cars for state/city selection and plate series storage
ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS plate_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS plate_country VARCHAR(8),
  ADD COLUMN IF NOT EXISTS plate_state VARCHAR(64),
  ADD COLUMN IF NOT EXISTS plate_city VARCHAR(128),
  ADD COLUMN IF NOT EXISTS plate_location_mode VARCHAR(8);

-- Optional index to help lookups by plate components
CREATE INDEX IF NOT EXISTS idx_cars_plate_code ON cars(plate_code);
CREATE INDEX IF NOT EXISTS idx_cars_plate_location ON cars(plate_country, plate_state, plate_city);
