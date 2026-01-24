ALTER TABLE accounting_journal_lines
  ADD COLUMN IF NOT EXISTS employee_id uuid NULL REFERENCES employees(id);
