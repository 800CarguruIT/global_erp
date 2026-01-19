-- Drop legacy name column from companies (display_name/legal_name are used instead)
ALTER TABLE companies
  DROP COLUMN IF EXISTS name;
