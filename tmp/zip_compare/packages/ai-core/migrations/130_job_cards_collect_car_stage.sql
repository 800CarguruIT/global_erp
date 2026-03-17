ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS collect_car_video_id text NULL,
  ADD COLUMN IF NOT EXISTS collect_car_mileage numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS collect_car_mileage_image_id text NULL,
  ADD COLUMN IF NOT EXISTS collect_car_at timestamptz NULL;
