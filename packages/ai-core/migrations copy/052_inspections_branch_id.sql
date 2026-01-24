-- 052_inspections_branch_id.sql
-- Add branch reference to inspections for branch-scoped check-ins.

BEGIN;

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_branch
  ON inspections (branch_id);

COMMIT;
