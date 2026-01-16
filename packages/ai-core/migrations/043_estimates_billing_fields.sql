-- 043_estimates_billing_fields.sql

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS total_vat numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_subtotal numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gp numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL,
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS invoice_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS payment_method text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimates_invoice_status_check'
  ) THEN
    ALTER TABLE estimates
      ADD CONSTRAINT estimates_invoice_status_check
        CHECK (invoice_status IN ('Pending', 'Invoiced'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimates_payment_status_check'
  ) THEN
    ALTER TABLE estimates
      ADD CONSTRAINT estimates_payment_status_check
        CHECK (payment_status IN ('Pending', 'Paid', 'Unpaid'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimates_payment_method_check'
  ) THEN
    ALTER TABLE estimates
      ADD CONSTRAINT estimates_payment_method_check
        CHECK (payment_method IS NULL OR payment_method IN ('Cash', 'POS', 'Bank Transfer', 'Cash On Delivery'));
  END IF;
END $$;
