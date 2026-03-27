-- Add dialer_location column to users table.
-- Values: 'inhouse' | 'remote' | NULL (not set)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dialer_location text NULL
    CHECK (dialer_location IN ('inhouse', 'remote'));
