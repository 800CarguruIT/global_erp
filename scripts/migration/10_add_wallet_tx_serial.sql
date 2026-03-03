-- Add simple serial number for wallet transactions without changing existing UUID flow.
-- Safe/idempotent for reruns.

ALTER TABLE public.customer_wallet_transactions
ADD COLUMN IF NOT EXISTS serial_no bigint;

CREATE SEQUENCE IF NOT EXISTS public.customer_wallet_tx_serial_seq;

ALTER TABLE public.customer_wallet_transactions
ALTER COLUMN serial_no SET DEFAULT nextval('public.customer_wallet_tx_serial_seq');

WITH missing AS (
  SELECT id
  FROM public.customer_wallet_transactions
  WHERE serial_no IS NULL
  ORDER BY created_at, id
)
UPDATE public.customer_wallet_transactions t
SET serial_no = nextval('public.customer_wallet_tx_serial_seq')
FROM missing
WHERE t.id = missing.id;

SELECT setval(
  'public.customer_wallet_tx_serial_seq',
  COALESCE((SELECT MAX(serial_no) FROM public.customer_wallet_transactions), 0) + 1,
  false
);

ALTER TABLE public.customer_wallet_transactions
ALTER COLUMN serial_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_wallet_transactions_serial_no
ON public.customer_wallet_transactions(serial_no);

SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE serial_no IS NULL) AS null_serial_rows,
  COUNT(DISTINCT serial_no) AS distinct_serial_rows,
  MIN(serial_no) AS min_serial,
  MAX(serial_no) AS max_serial
FROM public.customer_wallet_transactions;
