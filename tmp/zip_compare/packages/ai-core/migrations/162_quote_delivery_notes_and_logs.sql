ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS ordered_type text NULL,
  ADD COLUMN IF NOT EXISTS ordered_unit_price numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS delivery_note_no text NULL,
  ADD COLUMN IF NOT EXISTS delivery_note_status text NULL,
  ADD COLUMN IF NOT EXISTS delivery_note_payload jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_part_quotes_delivery_note_no
  ON part_quotes (delivery_note_no);

CREATE TABLE IF NOT EXISTS part_quote_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_quote_id uuid NULL REFERENCES part_quotes(id) ON DELETE SET NULL,
  delivery_note_no text NULL,
  event_type text NOT NULL,
  payload jsonb NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_part_quote_logs_company_created
  ON part_quote_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_part_quote_logs_quote
  ON part_quote_logs (part_quote_id, created_at DESC);
