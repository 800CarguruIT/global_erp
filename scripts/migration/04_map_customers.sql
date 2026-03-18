-- Customer-only migration: carguru2.customers -> public.customers
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_customer_map (
  legacy_customer_id bigint PRIMARY KEY,
  customer_id uuid NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_company_id uuid;
BEGIN
  v_company_id := NULLIF(current_setting('app.migration_company_id', true), '')::uuid;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Set app.migration_company_id before running this script.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id) THEN
    RAISE EXCEPTION 'Company % not found in public.companies', v_company_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'carguru2' AND table_name = 'customers'
  ) THEN
    RAISE EXCEPTION 'carguru2.customers not found. Import customers.sql first.';
  END IF;

  INSERT INTO migration.legacy_customer_map (legacy_customer_id, customer_id, company_id)
  SELECT c.id::bigint, gen_random_uuid(), v_company_id
  FROM carguru2.customers c
  WHERE NOT EXISTS (
    SELECT 1
    FROM migration.legacy_customer_map m
    WHERE m.legacy_customer_id = c.id::bigint
      AND m.company_id = v_company_id
  );

  INSERT INTO public.customers (
    id,
    company_id,
    customer_type,
    code,
    name,
    email,
    phone,
    phone_alt,
    address,
    notes,
    is_active,
    created_at,
    updated_at,
    country,
    city,
    wallet_amount,
    google_location
  )
  SELECT
    m.customer_id,
    v_company_id,
    CASE
      WHEN lower(trim(coalesce(c.type, ''))) IN ('chsc', 'customer happiness service contract', 'service contract') THEN 'CHSC'
      ELSE 'Regular'
    END AS customer_type,
    format('CU-LEG-%s', c.id),
    COALESCE(NULLIF(trim(c.name), ''), format('Legacy Customer %s', c.id)),
    CASE
      WHEN lower(trim(coalesce(c.email, ''))) IN ('', 'no email', 'n/a', 'na', 'null') THEN NULL
      ELSE lower(trim(c.email))
    END AS email,
    CASE
      WHEN trim(coalesce(c.phone, '')) IN ('', '0') THEN NULL
      ELSE trim(c.phone)
    END AS phone,
    CASE
      WHEN trim(coalesce(c.phone2, '')) IN ('', '0') THEN NULL
      ELSE trim(c.phone2)
    END AS phone_alt,
    NULLIF(trim(concat_ws(', ', NULLIF(c.area, ''), NULLIF(c.community, ''))), '') AS address,
    NULLIF(trim(concat_ws(' | ',
      CASE WHEN trim(coalesce(c.assign_to, '')) <> '' THEN concat('assign_to=', trim(c.assign_to)) END,
      CASE WHEN trim(coalesce(c.type, '')) <> '' THEN concat('legacy_type=', trim(c.type)) END,
      CASE WHEN trim(coalesce(c.dncr, '')) <> '' THEN concat('dncr=', trim(c.dncr)) END,
      CASE WHEN coalesce(c.liabilityDisclaimer, 0) <> 0 THEN 'liability_disclaimer=1' END,
      CASE WHEN trim(coalesce(c.device_id, '')) <> '' THEN 'has_device_id=1' END,
      concat('legacy_customer_id=', c.id)
    )), '') AS notes,
    CASE WHEN coalesce(c.status, 0) = 2 THEN false ELSE true END AS is_active,
    coalesce(c.date_created::timestamptz, now()) AS created_at,
    coalesce(c.date_created::timestamptz, now()) AS updated_at,
    CASE WHEN trim(coalesce(c.emirates, '')) <> '' THEN 'UAE' ELSE NULL END AS country,
    NULLIF(trim(c.emirates), '') AS city,
    coalesce(c.wallet_amount, 0)::numeric(14,2) AS wallet_amount,
    NULLIF(trim(c.area), '') AS google_location
  FROM carguru2.customers c
  JOIN migration.legacy_customer_map m
    ON m.legacy_customer_id = c.id::bigint
   AND m.company_id = v_company_id
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT
  count(*) FILTER (WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_customers
FROM migration.legacy_customer_map;

SELECT
  count(*) AS inserted_customers
FROM public.customers
WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid
  AND code LIKE 'CU-LEG-%';
