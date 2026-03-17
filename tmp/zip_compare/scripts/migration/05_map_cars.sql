-- Car migration: carguru2.cars -> public.cars + public.customer_car_links
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_car_map (
  company_id uuid NOT NULL,
  legacy_car_id bigint NOT NULL,
  legacy_customer_id bigint NOT NULL,
  car_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_car_id)
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
    WHERE table_schema = 'carguru2' AND table_name = 'cars'
  ) THEN
    RAISE EXCEPTION 'carguru2.cars not found. Import cars.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'migration' AND table_name = 'legacy_customer_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_customer_map not found. Run 04_map_customers.sql first.';
  END IF;

  -- One mapped UUID per legacy car (only when legacy customer is mapped for this company)
  INSERT INTO migration.legacy_car_map (company_id, legacy_car_id, legacy_customer_id, car_id)
  SELECT
    v_company_id,
    c.id::bigint,
    c.account_id::bigint,
    gen_random_uuid()
  FROM carguru2.cars c
  JOIN migration.legacy_customer_map cm
    ON cm.legacy_customer_id = c.account_id::bigint
   AND cm.company_id = v_company_id
  ON CONFLICT (company_id, legacy_car_id) DO NOTHING;

  INSERT INTO public.cars (
    id,
    company_id,
    code,
    plate_number,
    vin,
    make,
    model,
    model_year,
    body_type,
    tyre_size_front,
    tyre_size_back,
    registration_expiry,
    is_unregistered,
    is_active,
    is_insurance,
    notes,
    created_at,
    updated_at
  )
  SELECT
    m.car_id,
    v_company_id,
    format('CAR-LEG-%s', c.id),
    CASE
      WHEN trim(coalesce(c.car_plate, '')) IN ('', '0', '-') THEN format('UNREG-LEG-%s', c.id)
      ELSE trim(c.car_plate)
    END AS plate_number,
    CASE
      WHEN upper(trim(coalesce(c.car_vin, ''))) IN ('', '0', '-', 'N/A', 'NA', 'NULL') THEN NULL
      ELSE trim(c.car_vin)
    END AS vin,
    NULLIF(trim(c.car_make), ''),
    NULLIF(trim(c.car_model), ''),
    CASE WHEN coalesce(c.car_year, 0) BETWEEN 1900 AND 2100 THEN c.car_year ELSE NULL END AS model_year,
    NULLIF(trim(c.car_type), ''),
    NULLIF(trim(c.tyre_front), ''),
    NULLIF(trim(c.tyre_rear), ''),
    c.reg_expiry,
    CASE WHEN trim(coalesce(c.car_plate, '')) IN ('', '0', '-') THEN true ELSE false END AS is_unregistered,
    true AS is_active,
    CASE WHEN coalesce(c.ins_car, 0) <> 0 THEN true ELSE false END AS is_insurance,
    NULLIF(trim(concat_ws(' | ',
      concat('legacy_car_id=', c.id),
      concat('legacy_customer_id=', c.account_id),
      CASE WHEN trim(coalesce(c.car_cylinder, '')) <> '' THEN concat('cylinder=', trim(c.car_cylinder)) END,
      CASE WHEN coalesce(c.data_verified, 0) <> 0 THEN 'verified=1' END,
      CASE WHEN trim(coalesce(c.data_verified_by, '')) <> '' THEN concat('verified_by=', trim(c.data_verified_by)) END,
      CASE WHEN c.verify_date IS NOT NULL THEN concat('verify_date=', c.verify_date::text) END,
      CASE WHEN coalesce(c.promo, false) THEN 'promo=1' END,
      CASE WHEN coalesce(c.data_id, 0) <> 0 THEN concat('legacy_data_id=', c.data_id) END
    )), '') AS notes,
    coalesce(c.date_created::timestamptz, now()) AS created_at,
    coalesce(c.date_created::timestamptz, now()) AS updated_at
  FROM carguru2.cars c
  JOIN migration.legacy_car_map m
    ON m.company_id = v_company_id
   AND m.legacy_car_id = c.id::bigint
  ON CONFLICT (id) DO NOTHING;

  -- Link each imported car to its mapped customer.
  INSERT INTO public.customer_car_links (
    company_id,
    customer_id,
    car_id,
    relation_type,
    priority,
    is_primary,
    is_active,
    notes,
    created_at,
    updated_at
  )
  SELECT
    v_company_id,
    cm.customer_id,
    m.car_id,
    'owner',
    1,
    true,
    true,
    format('legacy_car_id=%s | legacy_customer_id=%s', m.legacy_car_id, m.legacy_customer_id),
    now(),
    now()
  FROM migration.legacy_car_map m
  JOIN migration.legacy_customer_map cm
    ON cm.company_id = m.company_id
   AND cm.legacy_customer_id = m.legacy_customer_id
  WHERE m.company_id = v_company_id
  ON CONFLICT (customer_id, car_id, relation_type, priority)
  DO UPDATE SET
    is_primary = EXCLUDED.is_primary,
    is_active = true,
    updated_at = now();
END $$;

SELECT
  count(*) FILTER (WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_cars
FROM migration.legacy_car_map;

SELECT
  count(*) AS inserted_cars
FROM public.cars
WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid
  AND code LIKE 'CAR-LEG-%';

SELECT
  count(*) AS inserted_links
FROM public.customer_car_links
WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid
  AND notes LIKE 'legacy_car_id=%';
