-- Track active/inactive customer-car links so historical (unlinked) cars can be shown
ALTER TABLE customer_car_links
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_customer_car_links_active ON customer_car_links(is_active);
