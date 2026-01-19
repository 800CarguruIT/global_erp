ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS wallet_amount numeric(14,2) NOT NULL DEFAULT 0;
