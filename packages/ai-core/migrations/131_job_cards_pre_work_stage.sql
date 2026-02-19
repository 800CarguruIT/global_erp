ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS pre_work_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pre_work_checked_by uuid NULL,
  ADD COLUMN IF NOT EXISTS pre_work_note text NULL;
