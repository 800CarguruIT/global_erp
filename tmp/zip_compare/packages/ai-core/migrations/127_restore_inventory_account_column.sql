-- Restore inventory account mapping for automated GRN accounting.

ALTER TABLE IF EXISTS accounting_company_settings
  ADD COLUMN IF NOT EXISTS inventory_account_id uuid NULL;

