ALTER TABLE accounting_journal_lines
  ADD COLUMN IF NOT EXISTS vendor_id uuid NULL REFERENCES vendors(id);
