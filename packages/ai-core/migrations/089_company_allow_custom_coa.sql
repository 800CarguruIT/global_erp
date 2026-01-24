ALTER TABLE IF EXISTS companies
ADD COLUMN IF NOT EXISTS allow_custom_coa boolean NOT NULL DEFAULT false;
