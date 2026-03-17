ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS working_video_id text NULL,
  ADD COLUMN IF NOT EXISTS final_inspection_test_drive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_inspection_cluster_warning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_inspection_car_wash boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_inspection_tyre_check boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_inspection_computer_reset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_inspection_protective_shields boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_inspection_remarks text NULL,
  ADD COLUMN IF NOT EXISTS final_inspection_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS final_inspection_by uuid NULL;
