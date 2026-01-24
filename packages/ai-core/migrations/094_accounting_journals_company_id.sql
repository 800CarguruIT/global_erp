ALTER TABLE accounting_journals ADD COLUMN IF NOT EXISTS company_id uuid NULL;
UPDATE accounting_journals AS j
SET company_id = e.company_id
FROM accounting_entities e
WHERE j.entity_id = e.id AND j.company_id IS NULL;
