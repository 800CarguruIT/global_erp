-- 037_google_locations.sql

ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_location text;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS google_location text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS google_location text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_location text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_location text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pickup_google_location text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dropoff_google_location text;
