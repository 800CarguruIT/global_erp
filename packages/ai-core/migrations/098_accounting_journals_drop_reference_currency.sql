ALTER TABLE accounting_journals
  DROP COLUMN IF EXISTS reference,
  DROP COLUMN IF EXISTS currency;
