ALTER TABLE accounting_journal_lines
  ADD COLUMN IF NOT EXISTS project_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cost_center text NULL;
