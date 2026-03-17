ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'Ordered';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'line_items_order_status_check'
  ) THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_order_status_check
      CHECK (order_status IN ('Ordered', 'Received', 'Returned'));
  END IF;
END $$;
