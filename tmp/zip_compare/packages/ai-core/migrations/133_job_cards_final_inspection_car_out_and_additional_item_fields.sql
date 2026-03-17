ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS final_inspection_car_out_video_id text NULL;

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS additional_item_mode text NULL,
  ADD COLUMN IF NOT EXISTS additional_item_image_id text NULL,
  ADD COLUMN IF NOT EXISTS customer_approval_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_additional_item_mode_check'
      AND conrelid = 'line_items'::regclass
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_additional_item_mode_check
      CHECK (
        additional_item_mode IS NULL
        OR LOWER(additional_item_mode) IN ('mandatory', 'recommended')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_customer_approval_status_check'
      AND conrelid = 'line_items'::regclass
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_customer_approval_status_check
      CHECK (LOWER(customer_approval_status) IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
