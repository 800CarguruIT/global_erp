-- 062_leads_car_videos.sql
-- Store car in/out video file references on leads.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS carin_video uuid NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS carout_video uuid NULL;
