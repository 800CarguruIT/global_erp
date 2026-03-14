-- 157_recovery_requests_dropoff_images.sql
-- Add dropoff evidence images for recovery workflow.

BEGIN;

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS dropoff_front_image text,
  ADD COLUMN IF NOT EXISTS dropoff_rear_image text,
  ADD COLUMN IF NOT EXISTS dropoff_right_image text,
  ADD COLUMN IF NOT EXISTS dropoff_left_image text,
  ADD COLUMN IF NOT EXISTS dropoff_cluster_image text;

COMMIT;
