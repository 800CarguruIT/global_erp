-- 073_line_items_order_status_pending.sql
ALTER TABLE line_items
  ALTER COLUMN order_status SET DEFAULT 'Pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_order_status_check'
  ) THEN
    ALTER TABLE line_items DROP CONSTRAINT line_items_order_status_check;
  END IF;

  ALTER TABLE line_items
    ADD CONSTRAINT line_items_order_status_check
    CHECK (order_status IN ('Pending', 'Ordered', 'Received', 'Returned'));
END $$;
