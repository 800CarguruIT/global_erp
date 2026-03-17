CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_transaction_map (
  company_id uuid NOT NULL,
  legacy_transaction_id bigint NOT NULL,
  wallet_transaction_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_transaction_id)
);

-- map legacy transaction ids to deterministic target ids (idempotent)
INSERT INTO migration.legacy_transaction_map (company_id, legacy_transaction_id, wallet_transaction_id)
SELECT
  '916d368c-6dc5-4835-9f01-7394a60d431c'::uuid,
  t.id::bigint,
  gen_random_uuid()
FROM carguru2_tx.transactions t
JOIN migration.legacy_customer_map cm
  ON cm.company_id = '916d368c-6dc5-4835-9f01-7394a60d431c'::uuid
 AND cm.legacy_customer_id = NULLIF(t.account_id::bigint, 0)
ON CONFLICT (company_id, legacy_transaction_id) DO NOTHING;

-- insert into wallet transactions (keep deleted=1 rows too; tagged in notes)
INSERT INTO public.customer_wallet_transactions (
  id,
  company_id,
  customer_id,
  amount,
  payment_method,
  payment_date,
  payment_proof_file_id,
  approved_at,
  approved_by,
  notes,
  created_at,
  updated_at
)
SELECT
  lm.wallet_transaction_id,
  lm.company_id,
  cm.customer_id,
  CASE
    WHEN lower(coalesce(t.direction, '')) = 'outward' THEN -abs(coalesce(t.payment_amount, 0)::numeric)
    ELSE abs(coalesce(t.payment_amount, 0)::numeric)
  END,
  CASE
    WHEN lower(coalesce(t.payment_mode, '')) LIKE '%pos%' THEN 'card'
    WHEN lower(coalesce(t.payment_mode, '')) LIKE '%tabby%' THEN 'online'
    WHEN lower(coalesce(t.payment_mode, '')) LIKE '%postpay%' THEN 'bank_transfer'
    WHEN lower(coalesce(t.payment_mode, '')) LIKE '%cash%' THEN 'cash'
    WHEN lower(coalesce(t.payment_mode, '')) LIKE '%loyalty%' THEN 'wallet'
    ELSE NULLIF(trim(t.payment_mode), '')
  END,
  t.pay_date,
  NULL::uuid,
  CASE WHEN coalesce(t.verified, 0) = 1 THEN coalesce(t.date_created::timestamptz, now()) ELSE NULL END,
  NULL::uuid,
  concat_ws(' | ',
    concat('legacy_tx_id=', t.id),
    concat('legacy_account_id=', t.account_id),
    concat('direction=', coalesce(t.direction, '')),
    concat('deleted=', CASE WHEN coalesce(t.deleted, false) THEN 1 ELSE 0 END),
    concat('verified=', coalesce(t.verified, 0)),
    concat('pay_depart=', coalesce(t.pay_depart, '')),
    CASE WHEN nullif(trim(coalesce(t.remarks, '')), '') IS NOT NULL THEN concat('remarks=', left(trim(t.remarks), 500)) END,
    'source=carguru2_tx.transactions'
  ),
  coalesce(t.date_created::timestamptz, now()),
  coalesce(t.modify_date::timestamptz, coalesce(t.date_created::timestamptz, now()))
FROM migration.legacy_transaction_map lm
JOIN carguru2_tx.transactions t
  ON t.id::bigint = lm.legacy_transaction_id
JOIN migration.legacy_customer_map cm
  ON cm.company_id = lm.company_id
 AND cm.legacy_customer_id = NULLIF(t.account_id::bigint, 0)
ON CONFLICT (id) DO NOTHING;

-- sync approval status for already-migrated rows too:
-- if legacy transaction is verified=1, target must be approved
UPDATE public.customer_wallet_transactions wt
SET
  approved_at = COALESCE(wt.approved_at, t.date_created::timestamptz, wt.created_at, now()),
  updated_at = now()
FROM migration.legacy_transaction_map lm
JOIN carguru2_tx.transactions t
  ON t.id::bigint = lm.legacy_transaction_id
WHERE wt.id = lm.wallet_transaction_id
  AND wt.company_id = lm.company_id
  AND lm.company_id = '916d368c-6dc5-4835-9f01-7394a60d431c'::uuid
  AND COALESCE(t.verified, 0) = 1
  AND wt.approved_at IS NULL;

SELECT
  (SELECT COUNT(*) FROM carguru2_tx.transactions) AS legacy_transactions,
  (SELECT COUNT(*) FROM carguru2_tx.transactions t JOIN migration.legacy_customer_map cm ON cm.company_id='916d368c-6dc5-4835-9f01-7394a60d431c'::uuid AND cm.legacy_customer_id=NULLIF(t.account_id::bigint,0)) AS mappable_transactions,
  (SELECT COUNT(*) FROM migration.legacy_transaction_map WHERE company_id='916d368c-6dc5-4835-9f01-7394a60d431c'::uuid) AS mapped_transactions,
  (SELECT COUNT(*) FROM public.customer_wallet_transactions wt WHERE wt.company_id='916d368c-6dc5-4835-9f01-7394a60d431c'::uuid AND wt.notes LIKE '%source=carguru2_tx.transactions%') AS inserted_wallet_transactions,
  (SELECT COUNT(*) FROM public.customer_wallet_transactions wt WHERE wt.company_id='916d368c-6dc5-4835-9f01-7394a60d431c'::uuid AND wt.notes LIKE '%source=carguru2_tx.transactions%' AND wt.notes LIKE '%deleted=1%') AS inserted_deleted_rows,
  (
    SELECT COUNT(*)
    FROM migration.legacy_transaction_map lm
    JOIN carguru2_tx.transactions t ON t.id::bigint = lm.legacy_transaction_id
    JOIN public.customer_wallet_transactions wt ON wt.id = lm.wallet_transaction_id
    WHERE lm.company_id='916d368c-6dc5-4835-9f01-7394a60d431c'::uuid
      AND COALESCE(t.verified, 0) = 1
      AND wt.approved_at IS NULL
  ) AS still_unapproved_but_verified;
