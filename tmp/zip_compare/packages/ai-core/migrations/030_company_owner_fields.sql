-- Add additional owner/contact fields for companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS owner_phone text NULL,
  ADD COLUMN IF NOT EXISTS owner_email text NULL,
  ADD COLUMN IF NOT EXISTS owner_address text NULL,
  ADD COLUMN IF NOT EXISTS owner_passport_file_id uuid NULL;

-- Index for owner email lookups (optional)
CREATE INDEX IF NOT EXISTS idx_companies_owner_email ON companies(owner_email);
