CREATE TABLE IF NOT EXISTS job_card_part_receipt_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_card_id uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  line_item_id uuid NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
  purchase_order_id uuid NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
  purchase_order_item_id uuid NULL REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  action text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  before_status text NULL,
  after_status text NULL,
  part_pic text NULL,
  actor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jc_part_receipt_logs_company_job
  ON job_card_part_receipt_logs (company_id, job_card_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jc_part_receipt_logs_line_item
  ON job_card_part_receipt_logs (line_item_id, created_at DESC);
