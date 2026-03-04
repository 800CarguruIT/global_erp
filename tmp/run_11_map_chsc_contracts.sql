SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';
-- CHSC migration: carguru2.chsc_* -> public.service_contract_*
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_chsc_package_map (
  company_id uuid NOT NULL,
  legacy_package_id bigint NOT NULL,
  package_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_package_id)
);

CREATE TABLE IF NOT EXISTS migration.legacy_chsc_contract_map (
  company_id uuid NOT NULL,
  legacy_chsc_customer_id bigint NOT NULL,
  contract_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_chsc_customer_id)
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
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'chsc_packages'
  ) THEN
    RAISE EXCEPTION 'carguru2.chsc_packages not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'chsc_customers'
  ) THEN
    RAISE EXCEPTION 'carguru2.chsc_customers not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'chsc_services'
  ) THEN
    RAISE EXCEPTION 'carguru2.chsc_services not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'migration' AND table_name = 'legacy_customer_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_customer_map not found. Run 04_map_customers.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'migration' AND table_name = 'legacy_car_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_car_map not found. Run 05_map_cars.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'migration' AND table_name = 'legacy_lead_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_lead_map not found. Run 06_map_leads.sql first.';
  END IF;

  INSERT INTO migration.legacy_chsc_package_map (company_id, legacy_package_id, package_id)
  SELECT
    v_company_id,
    p.id::bigint,
    gen_random_uuid()
  FROM carguru2.chsc_packages p
  ON CONFLICT (company_id, legacy_package_id) DO NOTHING;

  INSERT INTO public.service_contract_packages (
    id,
    company_id,
    legacy_package_id,
    code,
    name,
    plan_type,
    cylinder,
    mileage_limit,
    minor_count,
    major_count,
    base_price,
    solo_count,
    terms,
    description_html,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    pm.package_id,
    v_company_id,
    p.id::bigint,
    format('CHSC-%s', p.id::bigint),
    coalesce(nullif(trim(p.name), ''), format('Legacy CHSC Package %s', p.id::bigint)),
    nullif(trim(p.type), ''),
    NULLIF(p.cylinder::integer, 0),
    NULLIF(p.mileage::integer, 0),
    coalesce(p.minor::integer, 0),
    coalesce(p.major::integer, 0),
    coalesce(p.cost::numeric(14,2), 0),
    NULLIF(p.solo_count::numeric(10,2), 0),
    nullif(trim(p.terms), ''),
    nullif(p.description, ''),
    true,
    coalesce(p.date_created::timestamptz, now()),
    coalesce(p.date_created::timestamptz, now())
  FROM carguru2.chsc_packages p
  JOIN migration.legacy_chsc_package_map pm
    ON pm.company_id = v_company_id
   AND pm.legacy_package_id = p.id::bigint
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        plan_type = EXCLUDED.plan_type,
        cylinder = EXCLUDED.cylinder,
        mileage_limit = EXCLUDED.mileage_limit,
        minor_count = EXCLUDED.minor_count,
        major_count = EXCLUDED.major_count,
        base_price = EXCLUDED.base_price,
        solo_count = EXCLUDED.solo_count,
        terms = EXCLUDED.terms,
        description_html = EXCLUDED.description_html,
        updated_at = now();

  INSERT INTO migration.legacy_chsc_contract_map (company_id, legacy_chsc_customer_id, contract_id)
  SELECT
    v_company_id,
    cc.id::bigint,
    gen_random_uuid()
  FROM carguru2.chsc_customers cc
  ON CONFLICT (company_id, legacy_chsc_customer_id) DO NOTHING;

  INSERT INTO public.service_contracts (
    id,
    company_id,
    branch_id,
    customer_id,
    car_id,
    lead_id,
    package_id,
    legacy_chsc_customer_id,
    legacy_account_id,
    legacy_car_id,
    legacy_lead_id,
    legacy_invoice_id,
    contract_type,
    status,
    chsc_status,
    active,
    package_summary,
    minor_quota,
    major_quota,
    package_price,
    discount_amount,
    final_amount,
    sold_at,
    payment_mode,
    advisor_name,
    region,
    car_plate,
    customer_status,
    notes,
    created_at,
    updated_at
  )
  SELECT
    cm.contract_id,
    v_company_id,
    NULL::uuid,
    cust.customer_id,
    carm.car_id,
    leadm.lead_id,
    pm.package_id,
    cc.id::bigint,
    NULLIF(cc.account_id::bigint, 0),
    NULLIF(cc.car_id::bigint, 0),
    NULLIF(cc.lead_id::bigint, 0),
    NULLIF(cc.invoice_id::bigint, 0),
    coalesce(nullif(lower(trim(cc.status)), ''), 'upgrade'),
    CASE
      WHEN lower(trim(coalesce(cc.chsc_status, ''))) = 'cancelled' THEN 'cancelled'
      WHEN lower(trim(coalesce(cc.chsc_status, ''))) = 'renewed' THEN 'renewed'
      WHEN coalesce(cc.active, 1) = 0 THEN 'suspended'
      ELSE 'active'
    END,
    nullif(trim(cc.chsc_status), ''),
    coalesce(cc.active, 1) <> 0,
    nullif(trim(cc.package_summary), ''),
    coalesce(cc.minor::integer, 0),
    coalesce(cc.major::integer, 0),
    coalesce(cc.package_cost::numeric(14,2), 0),
    coalesce(cc.discount::numeric(14,2), 0),
    coalesce(cc.package_cost::numeric(14,2), 0) - coalesce(cc.discount::numeric(14,2), 0),
    coalesce(cc.date_sold::timestamptz, cc.date_created::timestamptz, now()),
    nullif(trim(cc.pay_mode), ''),
    nullif(trim(cc.advisor), ''),
    nullif(trim(cc.emirates), ''),
    nullif(trim(cc.car_plate), ''),
    nullif(trim(cc.customer_status), ''),
    nullif(trim(cc.fa_description), ''),
    coalesce(cc.date_created::timestamptz, now()),
    coalesce(cc.date_modified::timestamptz, cc.date_created::timestamptz, now())
  FROM carguru2.chsc_customers cc
  JOIN migration.legacy_chsc_contract_map cm
    ON cm.company_id = v_company_id
   AND cm.legacy_chsc_customer_id = cc.id::bigint
  JOIN migration.legacy_chsc_package_map pm
    ON pm.company_id = v_company_id
   AND pm.legacy_package_id = NULLIF(cc.package_id::bigint, 0)
  LEFT JOIN migration.legacy_customer_map cust
    ON cust.company_id = v_company_id
   AND cust.legacy_customer_id = NULLIF(cc.account_id::bigint, 0)
  LEFT JOIN migration.legacy_car_map carm
    ON carm.company_id = v_company_id
   AND carm.legacy_car_id = NULLIF(cc.car_id::bigint, 0)
  LEFT JOIN migration.legacy_lead_map leadm
    ON leadm.company_id = v_company_id
   AND leadm.legacy_lead_id = NULLIF(cc.lead_id::bigint, 0)
  ON CONFLICT (id) DO UPDATE
    SET branch_id = EXCLUDED.branch_id,
        customer_id = EXCLUDED.customer_id,
        car_id = EXCLUDED.car_id,
        lead_id = EXCLUDED.lead_id,
        package_id = EXCLUDED.package_id,
        contract_type = EXCLUDED.contract_type,
        status = EXCLUDED.status,
        chsc_status = EXCLUDED.chsc_status,
        active = EXCLUDED.active,
        package_summary = EXCLUDED.package_summary,
        minor_quota = EXCLUDED.minor_quota,
        major_quota = EXCLUDED.major_quota,
        package_price = EXCLUDED.package_price,
        discount_amount = EXCLUDED.discount_amount,
        final_amount = EXCLUDED.final_amount,
        sold_at = EXCLUDED.sold_at,
        payment_mode = EXCLUDED.payment_mode,
        advisor_name = EXCLUDED.advisor_name,
        region = EXCLUDED.region,
        car_plate = EXCLUDED.car_plate,
        customer_status = EXCLUDED.customer_status,
        notes = EXCLUDED.notes,
        updated_at = now();

  INSERT INTO public.service_contract_benefits (
    company_id,
    contract_id,
    benefit_type,
    product_id,
    benefit_value,
    description,
    is_redeemed,
    redeemed_at,
    created_at,
    updated_at
  )
  SELECT
    v_company_id,
    sc.id,
    coalesce(nullif(upper(trim(cc.free_addon)), ''), 'GENERIC'),
    nullif(trim(cc.free_product_id), ''),
    coalesce(cc.fa_value::numeric(14,2), 0),
    coalesce(nullif(trim(cc.fa_description), ''), nullif(trim(cc.free_addon), '')),
    false,
    NULL,
    coalesce(cc.date_created::timestamptz, now()),
    coalesce(cc.date_modified::timestamptz, cc.date_created::timestamptz, now())
  FROM carguru2.chsc_customers cc
  JOIN migration.legacy_chsc_contract_map cm
    ON cm.company_id = v_company_id
   AND cm.legacy_chsc_customer_id = cc.id::bigint
  JOIN public.service_contracts sc
    ON sc.id = cm.contract_id
   AND sc.company_id = v_company_id
  WHERE (
      nullif(trim(cc.free_addon), '') IS NOT NULL
      OR nullif(trim(cc.free_product_id), '') IS NOT NULL
      OR coalesce(cc.fa_value::numeric, 0) <> 0
      OR nullif(trim(cc.fa_description), '') IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_contract_benefits b
      WHERE b.company_id = v_company_id
        AND b.contract_id = sc.id
        AND b.benefit_type = coalesce(nullif(upper(trim(cc.free_addon)), ''), 'GENERIC')
        AND coalesce(b.product_id, '') = coalesce(nullif(trim(cc.free_product_id), ''), '')
        AND coalesce(b.description, '') = coalesce(coalesce(nullif(trim(cc.fa_description), ''), nullif(trim(cc.free_addon), '')), '')
    );

  WITH service_rows AS (
    SELECT
      s.id::bigint AS legacy_service_id,
      s.service_type,
      s.service_mileage,
      s.service_date,
      s.date_created,
      cm.contract_id
    FROM carguru2.chsc_services s
    JOIN migration.legacy_chsc_package_map pm
      ON pm.company_id = v_company_id
     AND pm.legacy_package_id = NULLIF(s.package_id::bigint, 0)
    JOIN LATERAL (
      SELECT sc.id AS contract_id
      FROM public.service_contracts sc
      WHERE sc.company_id = v_company_id
        AND sc.package_id = pm.package_id
        AND sc.legacy_account_id = NULLIF(s.account_id::bigint, 0)
        AND sc.legacy_car_id = NULLIF(s.car_id::bigint, 0)
      ORDER BY coalesce(sc.sold_at, sc.created_at) DESC, sc.created_at DESC
      LIMIT 1
    ) cm ON true
  ),
  numbered AS (
    SELECT
      r.*,
      row_number() OVER (
        PARTITION BY r.contract_id, lower(trim(coalesce(r.service_type, 'minor')))
        ORDER BY r.legacy_service_id
      ) AS seq_no
    FROM service_rows r
  )
  INSERT INTO public.service_contract_entitlements (
    company_id,
    contract_id,
    service_kind,
    sequence_no,
    planned_mileage,
    planned_date,
    status,
    consumed_mileage,
    consumed_at,
    legacy_service_id,
    created_at,
    updated_at
  )
  SELECT
    v_company_id,
    n.contract_id,
    CASE
      WHEN lower(trim(coalesce(n.service_type, 'minor'))) = 'major' THEN 'major'
      ELSE 'minor'
    END AS service_kind,
    n.seq_no,
    CASE WHEN n.service_date IS NULL THEN NULLIF(n.service_mileage::integer, 0) ELSE NULL END,
    n.service_date,
    CASE WHEN n.service_date IS NULL THEN 'pending' ELSE 'done' END,
    CASE WHEN n.service_date IS NULL THEN NULL ELSE NULLIF(n.service_mileage::integer, 0) END,
    n.service_date,
    n.legacy_service_id,
    coalesce(n.date_created::timestamptz, now()),
    coalesce(n.date_created::timestamptz, now())
  FROM numbered n
  ON CONFLICT (company_id, legacy_service_id) DO NOTHING;
END $$;

SELECT
  (SELECT count(*) FROM migration.legacy_chsc_package_map WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_packages,
  (SELECT count(*) FROM migration.legacy_chsc_contract_map WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_contracts,
  (SELECT count(*) FROM public.service_contract_packages WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_packages,
  (SELECT count(*) FROM public.service_contracts WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_contracts,
  (SELECT count(*) FROM public.service_contract_benefits WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_benefits,
  (SELECT count(*) FROM public.service_contract_entitlements WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_entitlements;
