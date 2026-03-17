-- Backfill missing legacy leads referenced by carguru2.inspections
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

DO $$
DECLARE
  v_company_id uuid;
BEGIN
  v_company_id := NULLIF(current_setting('app.migration_company_id', true), '')::uuid;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Set app.migration_company_id before running this script.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'inspections'
  ) THEN
    RAISE EXCEPTION 'carguru2.inspections not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'migration' AND table_name = 'legacy_lead_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_lead_map not found. Run 06_map_leads.sql first.';
  END IF;

  -- Add legacy_lead_map rows for inspection lead_ids that are missing in lead map.
  INSERT INTO migration.legacy_lead_map (company_id, legacy_lead_id, legacy_customer_id, legacy_car_id, lead_id)
  SELECT
    v_company_id,
    i.lead_id::bigint,
    NULLIF(car.account_id::bigint, 0) AS legacy_customer_id,
    NULLIF(i.car_id::bigint, 0) AS legacy_car_id,
    gen_random_uuid()
  FROM carguru2.inspections i
  LEFT JOIN carguru2.cars car ON car.id = i.car_id
  LEFT JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = i.lead_id::bigint
  WHERE lm.legacy_lead_id IS NULL
  ON CONFLICT (company_id, legacy_lead_id) DO NOTHING;

  -- Insert placeholder leads so inspections can remain linked to lead_id.
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
    contact_phone,
    service_type
  )
  SELECT
    lm.lead_id,
    v_company_id,
    cm.customer_id,
    carm.car_id,
    'workshop',
    CASE
      WHEN lower(trim(coalesce(i.status, ''))) = 'completed' THEN 'completed'
      ELSE 'open'
    END,
    'inspection',
    'legacy_inspection_fallback',
    coalesce(i.date_created::timestamptz, now()),
    coalesce(i.date_completed::timestamptz, i.date_created::timestamptz, now()),
    CASE WHEN lower(trim(coalesce(i.status, ''))) = 'completed' THEN i.date_completed::timestamptz ELSE NULL END,
    NULLIF(trim(i.lead_remarks), ''),
    NULLIF(trim(i.inspector_remarks), ''),
    'company',
    coalesce(NULLIF(trim(i.inspector_name), ''), 'Legacy Inspection Lead'),
    NULL,
    'inspection'
  FROM carguru2.inspections i
  JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = i.lead_id::bigint
  LEFT JOIN migration.legacy_car_map carm
    ON carm.company_id = v_company_id
   AND carm.legacy_car_id = NULLIF(i.car_id::bigint, 0)
  LEFT JOIN carguru2.cars car
    ON car.id = i.car_id
  LEFT JOIN migration.legacy_customer_map cm
    ON cm.company_id = v_company_id
   AND cm.legacy_customer_id = NULLIF(car.account_id::bigint, 0)
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT count(*) AS mapped_leads_for_inspections
FROM migration.legacy_lead_map lm
WHERE lm.company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid
  AND EXISTS (
    SELECT 1 FROM carguru2.inspections i WHERE i.lead_id::bigint = lm.legacy_lead_id
  );
