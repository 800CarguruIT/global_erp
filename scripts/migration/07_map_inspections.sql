-- Inspection migration: carguru2.inspections -> public.inspections
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_inspection_map (
  company_id uuid NOT NULL,
  legacy_inspection_id bigint NOT NULL,
  legacy_lead_id bigint NOT NULL,
  inspection_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_inspection_id)
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
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'inspections'
  ) THEN
    RAISE EXCEPTION 'carguru2.inspections not found. Import inspections.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'migration' AND table_name = 'legacy_lead_map'
  ) THEN
    RAISE EXCEPTION 'migration.legacy_lead_map not found. Run 06_map_leads.sql first.';
  END IF;

  INSERT INTO migration.legacy_inspection_map (company_id, legacy_inspection_id, legacy_lead_id, inspection_id)
  SELECT
    v_company_id,
    i.id::bigint,
    i.lead_id::bigint,
    gen_random_uuid()
  FROM carguru2.inspections i
  JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = i.lead_id::bigint
  ON CONFLICT (company_id, legacy_inspection_id) DO NOTHING;

  INSERT INTO public.inspections (
    id,
    company_id,
    lead_id,
    car_id,
    customer_id,
    status,
    health_engine,
    health_transmission,
    health_brakes,
    health_suspension,
    health_electrical,
    overall_health,
    customer_remark,
    inspector_remark,
    inspector_remark_layman,
    draft_payload,
    created_at,
    updated_at,
    start_at,
    complete_at,
    verified_at
  )
  SELECT
    im.inspection_id,
    v_company_id,
    lm.lead_id,
    COALESCE(l.car_id, carm.car_id),
    COALESCE(l.customer_id, cm.customer_id),
    CASE
      WHEN lower(trim(coalesce(i.status, ''))) = 'completed' THEN 'completed'
      WHEN lower(trim(coalesce(i.status, ''))) = 'pending' THEN 'pending'
      ELSE 'pending'
    END AS status,
    NULLIF(i.engine, 0),
    NULLIF(i.gear, 0),
    NULLIF(i.brakes, 0),
    NULLIF(i.suspension, 0),
    NULLIF(i.battery, 0),
    NULLIF(((coalesce(i.engine, 0) + coalesce(i.gear, 0) + coalesce(i.brakes, 0) + coalesce(i.suspension, 0) + coalesce(i.battery, 0)) / 5), 0),
    NULLIF(trim(i.lead_remarks), ''),
    NULLIF(trim(i.inspector_remarks), ''),
    NULLIF(trim(concat_ws(' | ',
      CASE WHEN trim(coalesce(i.inspector_name, '')) <> '' THEN concat('inspector=', trim(i.inspector_name)) END,
      CASE WHEN trim(coalesce(i.insp_location, '')) <> '' THEN concat('location=', trim(i.insp_location)) END,
      CASE WHEN trim(coalesce(i.car_plate, '')) <> '' THEN concat('legacy_plate=', trim(i.car_plate)) END,
      CASE WHEN coalesce(i.reassign, 0) <> 0 THEN concat('reassign=', i.reassign::text) END
    )), ''),
    jsonb_build_object(
      'advisorName', CASE WHEN trim(coalesce(i.insp_location, '')) <> '' THEN concat(trim(i.insp_location), '_Department') ELSE '' END,
      'inspectorName', coalesce(i.inspector_name, ''),
      'carInMileage', '',
      'customerComplain', coalesce(i.lead_remarks, ''),
      'inspectorRemarks', coalesce(i.inspector_remarks, ''),
      'checks', jsonb_build_object(
        'engine', CASE WHEN coalesce(i.engine, 0) = 1 THEN 'good' WHEN coalesce(i.engine, 0) = 2 THEN 'avg' WHEN coalesce(i.engine, 0) > 2 THEN 'bad' ELSE '' END,
        'steering', CASE WHEN coalesce(i.steering, 0) = 1 THEN 'good' WHEN coalesce(i.steering, 0) = 2 THEN 'avg' WHEN coalesce(i.steering, 0) > 2 THEN 'bad' ELSE '' END,
        'tyres', CASE WHEN coalesce(i.tyres, 0) = 1 THEN 'good' WHEN coalesce(i.tyres, 0) = 2 THEN 'avg' WHEN coalesce(i.tyres, 0) > 2 THEN 'bad' ELSE '' END,
        'ac', CASE WHEN coalesce(i.ac_cooling, 0) = 1 THEN 'good' WHEN coalesce(i.ac_cooling, 0) = 2 THEN 'avg' WHEN coalesce(i.ac_cooling, 0) > 2 THEN 'bad' ELSE '' END,
        'body', CASE WHEN coalesce(i.car_body, 0) = 1 THEN 'good' WHEN coalesce(i.car_body, 0) = 2 THEN 'avg' WHEN coalesce(i.car_body, 0) > 2 THEN 'bad' ELSE '' END,
        'gear', CASE WHEN coalesce(i.gear, 0) = 1 THEN 'good' WHEN coalesce(i.gear, 0) = 2 THEN 'avg' WHEN coalesce(i.gear, 0) > 2 THEN 'bad' ELSE '' END,
        'suspension', CASE WHEN coalesce(i.suspension, 0) = 1 THEN 'good' WHEN coalesce(i.suspension, 0) = 2 THEN 'avg' WHEN coalesce(i.suspension, 0) > 2 THEN 'bad' ELSE '' END,
        'brakes', CASE WHEN coalesce(i.brakes, 0) = 1 THEN 'good' WHEN coalesce(i.brakes, 0) = 2 THEN 'avg' WHEN coalesce(i.brakes, 0) > 2 THEN 'bad' ELSE '' END,
        'battery', CASE WHEN coalesce(i.battery, 0) = 1 THEN 'good' WHEN coalesce(i.battery, 0) = 2 THEN 'avg' WHEN coalesce(i.battery, 0) > 2 THEN 'bad' ELSE '' END,
        'infotainment', CASE WHEN coalesce(i.infotainment, 0) = 1 THEN 'good' WHEN coalesce(i.infotainment, 0) = 2 THEN 'avg' WHEN coalesce(i.infotainment, 0) > 2 THEN 'bad' ELSE '' END
      ),
      'legacySnapshot', true,
      'legacyInspectionId', i.id
    ),
    coalesce(i.date_created::timestamptz, now()),
    coalesce(i.date_completed::timestamptz, i.date_verified::timestamptz, i.date_created::timestamptz, now()),
    coalesce(i.date_created::timestamptz, now()),
    CASE WHEN lower(trim(coalesce(i.status, ''))) = 'completed' THEN i.date_completed::timestamptz ELSE NULL END,
    i.date_verified::timestamptz
  FROM carguru2.inspections i
  JOIN migration.legacy_inspection_map im
    ON im.company_id = v_company_id
   AND im.legacy_inspection_id = i.id::bigint
  JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = i.lead_id::bigint
  LEFT JOIN public.leads l
    ON l.id = lm.lead_id
   AND l.company_id = v_company_id
  LEFT JOIN migration.legacy_car_map carm
    ON carm.company_id = v_company_id
   AND carm.legacy_car_id = NULLIF(i.car_id::bigint, 0)
  LEFT JOIN carguru2.leads ll
    ON ll.id = i.lead_id
  LEFT JOIN migration.legacy_customer_map cm
    ON cm.company_id = v_company_id
   AND cm.legacy_customer_id = NULLIF(ll.account_id::bigint, 0)
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT
  count(*) FILTER (WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_inspections
FROM migration.legacy_inspection_map;

SELECT
  count(*) AS inserted_inspections
FROM public.inspections ins
JOIN migration.legacy_inspection_map im
  ON im.company_id = ins.company_id
 AND im.inspection_id = ins.id
WHERE ins.company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid;
