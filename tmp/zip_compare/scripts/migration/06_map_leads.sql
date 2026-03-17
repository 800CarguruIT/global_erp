-- Lead migration: carguru2.leads -> public.leads
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_lead_map (
  company_id uuid NOT NULL,
  legacy_lead_id bigint NOT NULL,
  legacy_customer_id bigint NULL,
  legacy_car_id bigint NULL,
  lead_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_lead_id)
);

DO $$
DECLARE
  v_company_id uuid;
  v_batch_size bigint := 20000;
  v_min_id bigint;
  v_max_id bigint;
  v_from_id bigint;
  v_to_id bigint;
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
    WHERE table_schema = 'carguru2' AND table_name = 'leads'
  ) THEN
    RAISE EXCEPTION 'carguru2.leads not found. Import leads.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'migration' AND table_name = 'legacy_customer_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_customer_map not found. Run 04_map_customers.sql first.';
  END IF;

  SELECT min(id)::bigint, max(id)::bigint
  INTO v_min_id, v_max_id
  FROM carguru2.leads;

  IF v_min_id IS NULL OR v_max_id IS NULL THEN
    RETURN;
  END IF;

  v_from_id := v_min_id;
  WHILE v_from_id <= v_max_id LOOP
    v_to_id := LEAST(v_from_id + v_batch_size - 1, v_max_id);

    INSERT INTO migration.legacy_lead_map (
      company_id,
      legacy_lead_id,
      legacy_customer_id,
      legacy_car_id,
      lead_id
    )
    SELECT
      v_company_id,
      l.id::bigint,
      NULLIF(l.account_id::bigint, 0),
      NULLIF(l.car_id::bigint, 0),
      gen_random_uuid()
    FROM carguru2.leads l
    WHERE l.id::bigint BETWEEN v_from_id AND v_to_id
    ON CONFLICT (company_id, legacy_lead_id) DO NOTHING;

    INSERT INTO public.leads (
      id,
      company_id,
      customer_id,
      car_id,
      lead_type,
      lead_status,
      lead_stage,
      source,
      created_at,
      updated_at,
      closed_at,
      customer_remark,
      agent_remark,
      scope,
      contact_name,
      contact_email,
      contact_phone,
      service_type,
      pickup_from,
      dropoff_to,
      recovery_direction,
      recovery_flow
    )
    SELECT
      lm.lead_id,
      v_company_id,
      cm.customer_id,
      carm.car_id,
      CASE
        WHEN lower(trim(coalesce(l.type, ''))) = 'complaint' THEN 'complaint'
        WHEN coalesce(l.recovery_requested, false) OR lower(trim(coalesce(l.department, ''))) = 'onsite' THEN 'recovery'
        WHEN lower(trim(coalesce(l.type, ''))) IN ('warranty', 'follow_up') THEN 'support'
        ELSE 'workshop'
      END AS lead_type,
      CASE
        WHEN lower(trim(coalesce(l.stage, ''))) = 'car in' THEN 'car_in'
        WHEN lower(trim(coalesce(l.status, ''))) IN ('pending') THEN 'open'
        WHEN lower(trim(coalesce(l.status, ''))) IN ('done', 'resolved', 'completed') THEN 'completed'
        WHEN lower(trim(coalesce(l.status, ''))) IN ('contract') THEN 'accepted'
        WHEN lower(trim(coalesce(l.status, ''))) IN ('lost', 'cancelled', 'unrelated') THEN 'lost'
        ELSE 'processing'
      END AS lead_status,
      coalesce(
        nullif(
          trim(both '_' from regexp_replace(lower(trim(coalesce(l.stage, ''))), '[^a-z0-9]+', '_', 'g')),
          ''
        ),
        'new_lead'
      ) AS lead_stage,
      NULLIF(trim(concat_ws(' / ', NULLIF(l.source, ''), NULLIF(l.subsource, ''))), '') AS source,
      coalesce(l.date_created::timestamptz, now()) AS created_at,
      coalesce(l.date_modified::timestamptz, l.date_created::timestamptz, now()) AS updated_at,
      CASE
        WHEN lower(trim(coalesce(l.status, ''))) IN ('done', 'resolved', 'completed', 'lost', 'cancelled', 'unrelated')
          OR lower(trim(coalesce(l.stage, ''))) IN ('completed', 'job completed', 'car out')
        THEN coalesce(l.date_modified::timestamptz, l.date_created::timestamptz, now())
        ELSE NULL
      END AS closed_at,
      NULLIF(trim(l.remarks), '') AS customer_remark,
      NULLIF(trim(l.agent_remarks), '') AS agent_remark,
      'company' AS scope,
      COALESCE(NULLIF(trim(l.name), ''), format('Legacy Lead %s', l.id)) AS contact_name,
      CASE
        WHEN lower(trim(coalesce(l.email, ''))) IN ('', 'no email', 'n/a', 'na', 'null', '-') THEN NULL
        ELSE lower(trim(l.email))
      END AS contact_email,
      CASE
        WHEN trim(coalesce(l.phone::text, '')) IN ('', '0') THEN NULL
        ELSE trim(l.phone::text)
      END AS contact_phone,
      NULLIF(trim(l.department), '') AS service_type,
      NULLIF(trim(l.pickup_location), '') AS pickup_from,
      NULLIF(trim(l.complaint_location), '') AS dropoff_to,
      NULLIF(trim(concat_ws(' -> ', NULLIF(l.pickup_recovery, ''), NULLIF(l.dropoff_recovery, ''))), '') AS recovery_direction,
      CASE WHEN coalesce(l.recovery_requested, false) THEN 'legacy_recovery' ELSE NULL END AS recovery_flow
    FROM carguru2.leads l
    JOIN migration.legacy_lead_map lm
      ON lm.company_id = v_company_id
     AND lm.legacy_lead_id = l.id::bigint
    LEFT JOIN migration.legacy_customer_map cm
      ON cm.company_id = v_company_id
     AND cm.legacy_customer_id = NULLIF(l.account_id::bigint, 0)
    LEFT JOIN migration.legacy_car_map carm
      ON carm.company_id = v_company_id
     AND carm.legacy_car_id = NULLIF(l.car_id::bigint, 0)
    WHERE l.id::bigint BETWEEN v_from_id AND v_to_id
    ON CONFLICT (id) DO NOTHING;

    v_from_id := v_to_id + 1;
  END LOOP;
END $$;

SELECT
  count(*) FILTER (WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_leads
FROM migration.legacy_lead_map;

SELECT
  count(*) AS inserted_legacy_leads
FROM public.leads l
JOIN migration.legacy_lead_map lm
  ON lm.company_id = l.company_id
 AND lm.lead_id = l.id
WHERE l.company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid;
