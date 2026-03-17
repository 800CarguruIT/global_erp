-- 156_recovery_requests_pickup_images.sql
-- Add pickup evidence images for recovery workflow.

BEGIN;

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS pickup_front_image text,
  ADD COLUMN IF NOT EXISTS pickup_rear_image text,
  ADD COLUMN IF NOT EXISTS pickup_right_image text,
  ADD COLUMN IF NOT EXISTS pickup_left_image text,
  ADD COLUMN IF NOT EXISTS pickup_cluster_image text;

COMMIT;
