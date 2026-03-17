ALTER TABLE workshop_quotes
  ADD COLUMN IF NOT EXISTS quoted_amount numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS accepted_amount numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS additional_amount numeric(14,2) NOT NULL DEFAULT 0;

UPDATE workshop_quotes
SET quoted_amount = COALESCE(quoted_amount, total_amount)
WHERE quoted_amount IS NULL;

UPDATE workshop_quotes
SET accepted_amount = COALESCE(accepted_amount, negotiated_amount, quoted_amount, total_amount)
WHERE accepted_amount IS NULL
  AND LOWER(COALESCE(status, '')) IN ('accepted', 'completed', 'verified');
