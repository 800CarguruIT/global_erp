ALTER TABLE accounting_journals ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT '';
