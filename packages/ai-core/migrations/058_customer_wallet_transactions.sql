CREATE TABLE IF NOT EXISTS customer_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  payment_method text NULL,
  payment_date date NULL,
  payment_proof_file_id uuid NULL,
  approved_at timestamptz NULL,
  approved_by uuid NULL REFERENCES users(id),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer ON customer_wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_company ON customer_wallet_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_approved ON customer_wallet_transactions(approved_at);
