-- Ensure the existing tables gain the entity_id columns the repository expects.
ALTER TABLE accounting_journals
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES accounting_entities(id),
  ADD COLUMN IF NOT EXISTS franchise_id uuid NULL;

ALTER TABLE accounting_journal_lines
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES accounting_entities(id),
  ADD COLUMN IF NOT EXISTS franchise_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_journals_entity ON accounting_journals (entity_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entity ON accounting_journal_lines (entity_id);
