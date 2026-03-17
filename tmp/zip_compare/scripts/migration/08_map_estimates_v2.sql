-- Estimate migration v2: carguru2.estimates -> public.estimates + public.job_cards
-- Handles legacy inline job-card data while preserving modern one-to-many model
-- (creates one base job_card per legacy estimate; more job cards can be added later).
--
-- Required runtime setting:
--   SET app.migration_company_id = '916d368c-6dc5-4835-9f01-7394a60d431c';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_estimate_map_v2 (
  company_id uuid NOT NULL,
  legacy_estimate_id bigint NOT NULL,
  legacy_lead_id bigint NULL,
  legacy_car_id bigint NULL,
  legacy_customer_id bigint NULL,
  estimate_id uuid NOT NULL UNIQUE,
  inspection_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_estimate_id)
);

CREATE TABLE IF NOT EXISTS migration.legacy_job_card_map_v2 (
  company_id uuid NOT NULL,
  legacy_estimate_id bigint NOT NULL,
  job_card_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_estimate_id)
);

CREATE TABLE IF NOT EXISTS migration.legacy_line_item_map_v2 (
  company_id uuid NOT NULL,
  legacy_line_item_id bigint NOT NULL,
  legacy_estimate_id bigint NOT NULL,
  line_item_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, legacy_line_item_id)
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
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'estimates'
  ) THEN
    RAISE EXCEPTION 'carguru2.estimates not found. Import estimates SQL first.';
  END IF;

  INSERT INTO migration.legacy_estimate_map_v2 (
    company_id,
    legacy_estimate_id,
    legacy_lead_id,
    legacy_car_id,
    legacy_customer_id,
    estimate_id,
    inspection_id
  )
  SELECT
    v_company_id,
    e.id::bigint,
    NULLIF(e.lead_id::bigint, 0),
    NULLIF(e.car_id::bigint, 0),
    NULLIF(e.account_id::bigint, 0),
    gen_random_uuid(),
    COALESCE(im.inspection_id, gen_random_uuid())
  FROM carguru2.estimates e
  LEFT JOIN migration.legacy_inspection_map im
    ON im.company_id = v_company_id
   AND im.legacy_lead_id = NULLIF(e.lead_id::bigint, 0)
  ON CONFLICT (company_id, legacy_estimate_id) DO NOTHING;

  -- Ensure each mapped estimate has an inspection_id row in public.inspections.
  INSERT INTO public.inspections (
    id,
    company_id,
    lead_id,
    car_id,
    customer_id,
    status,
    customer_remark,
    inspector_remark,
    draft_payload,
    created_at,
    updated_at,
    start_at,
    complete_at
  )
  SELECT
    em.inspection_id,
    v_company_id,
    lm.lead_id,
    COALESCE(carm.car_id, l.car_id),
    COALESCE(cm.customer_id, l.customer_id),
    CASE
      WHEN lower(trim(coalesce(e.job_status, ''))) IN ('job completed', 'completed', 'done')
        OR lower(trim(coalesce(e.estimate_status, ''))) = 'invoiced'
      THEN 'completed'
      WHEN e.job_start IS NOT NULL THEN 'started'
      ELSE 'pending'
    END,
    NULLIF(trim(e.lead_remarks), ''),
    NULLIF(trim(e.inspector_remarks), ''),
    jsonb_build_object(
      'legacySnapshot', true,
      'legacyEstimateId', e.id,
      'advisorName', coalesce(nullif(trim(e.job_technician), ''), ''),
      'inspectorName', coalesce(nullif(trim(e.final_inspector), ''), ''),
      'customerComplain', coalesce(nullif(trim(e.lead_remarks), ''), ''),
      'inspectorRemarks', coalesce(nullif(trim(e.inspector_remarks), ''), '')
    ),
    COALESCE(e.date_created::timestamptz, now()),
    COALESCE(e.date_modified::timestamptz, COALESCE(e.date_created::timestamptz, now())),
    e.job_start::timestamptz,
    e.job_end::timestamptz
  FROM migration.legacy_estimate_map_v2 em
  JOIN carguru2.estimates e
    ON e.id::bigint = em.legacy_estimate_id
  LEFT JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = em.legacy_lead_id
  LEFT JOIN public.leads l
    ON l.id = lm.lead_id
   AND l.company_id = v_company_id
  LEFT JOIN migration.legacy_car_map carm
    ON carm.company_id = v_company_id
   AND carm.legacy_car_id = em.legacy_car_id
  LEFT JOIN migration.legacy_customer_map cm
    ON cm.company_id = v_company_id
   AND cm.legacy_customer_id = em.legacy_customer_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.estimates (
    id,
    company_id,
    inspection_id,
    lead_id,
    car_id,
    customer_id,
    status,
    currency,
    vat_rate,
    total_cost,
    total_sale,
    total_discount,
    final_price,
    vat_amount,
    grand_total,
    total_vat,
    total_subtotal,
    total_gp,
    invoice_status,
    invoice_date,
    payment_status,
    payment_method,
    created_at,
    updated_at,
    meta
  )
  SELECT
    em.estimate_id,
    v_company_id,
    em.inspection_id,
    lm.lead_id,
    COALESCE(carm.car_id, l.car_id),
    cm.customer_id,
    CASE
      WHEN lower(trim(coalesce(e.estimate_status, ''))) = 'invoiced' THEN 'finalized'
      WHEN lower(trim(coalesce(e.estimate_status, ''))) = 'pending' THEN 'draft'
      ELSE 'draft'
    END,
    'AED',
    5.00,
    COALESCE(e.total_cost, 0)::numeric(14,2),
    COALESCE(e.total_sale, 0)::numeric(14,2),
    COALESCE(e.total_discount, 0)::numeric(14,2),
    COALESCE(e.grand_total, 0)::numeric(14,2),
    COALESCE(e.total_vat, 0)::numeric(14,2),
    COALESCE(e.grand_total, 0)::numeric(14,2),
    COALESCE(e.total_vat, 0)::numeric(14,2),
    COALESCE(e.total_subtotal, 0)::numeric(14,2),
    CASE
      WHEN regexp_replace(trim(coalesce(e.total_gp, '')), '[^0-9\\.-]', '', 'g') IN ('', '-', '.', '-.')
      THEN 0::numeric(14,2)
      ELSE regexp_replace(trim(coalesce(e.total_gp, '')), '[^0-9\\.-]', '', 'g')::numeric(14,2)
    END,
    CASE WHEN lower(trim(coalesce(e.estimate_status, ''))) = 'invoiced' THEN 'Invoiced' ELSE 'Pending' END,
    e.invoice_date::timestamptz,
    CASE
      WHEN lower(trim(coalesce(e.invoice_status, ''))) = 'paid' THEN 'Paid'
      WHEN lower(trim(coalesce(e.invoice_status, ''))) = 'unpaid' THEN 'Unpaid'
      ELSE 'Pending'
    END,
    CASE
      WHEN lower(trim(coalesce(e.payment_method, ''))) LIKE '%cash%' THEN 'Cash'
      WHEN lower(trim(coalesce(e.payment_method, ''))) LIKE '%pos%' THEN 'POS'
      WHEN lower(trim(coalesce(e.payment_method, ''))) LIKE '%bank%' THEN 'Bank Transfer'
      WHEN lower(trim(coalesce(e.payment_method, ''))) LIKE '%delivery%' THEN 'Cash On Delivery'
      ELSE NULL
    END,
    COALESCE(e.date_created::timestamptz, now()),
    COALESCE(e.date_modified::timestamptz, COALESCE(e.date_created::timestamptz, now())),
    jsonb_build_object(
      'legacy_source', 'carguru2.estimates',
      'legacy_estimate_id', e.id,
      'legacy_lead_id', e.lead_id,
      'legacy_account_id', e.account_id,
      'legacy_car_id', e.car_id,
      'legacy_job_status', e.job_status,
      'legacy_invoice_status', e.invoice_status,
      'legacy_order_status', e.order_status,
      'legacy_issue_jc', e.issue_jc
    )
  FROM migration.legacy_estimate_map_v2 em
  JOIN carguru2.estimates e
    ON e.id::bigint = em.legacy_estimate_id
  LEFT JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = em.legacy_lead_id
  LEFT JOIN public.leads l
    ON l.id = lm.lead_id
   AND l.company_id = v_company_id
  LEFT JOIN migration.legacy_car_map carm
    ON carm.company_id = v_company_id
   AND carm.legacy_car_id = em.legacy_car_id
  LEFT JOIN migration.legacy_customer_map cm
    ON cm.company_id = v_company_id
   AND cm.legacy_customer_id = em.legacy_customer_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO migration.legacy_job_card_map_v2 (company_id, legacy_estimate_id, job_card_id)
  SELECT
    v_company_id,
    em.legacy_estimate_id,
    gen_random_uuid()
  FROM migration.legacy_estimate_map_v2 em
  WHERE em.company_id = v_company_id
  ON CONFLICT (company_id, legacy_estimate_id) DO NOTHING;

  INSERT INTO public.job_cards (
    id,
    estimate_id,
    lead_id,
    status,
    remarks,
    start_at,
    complete_at,
    created_at,
    updated_at,
    final_inspection_remarks,
    final_inspection_at
  )
  SELECT
    jm.job_card_id,
    em.estimate_id,
    lm.lead_id,
    CASE
      WHEN lower(trim(coalesce(e.job_status, ''))) IN ('job completed', 'completed', 'done') THEN 'Completed'
      WHEN lower(trim(coalesce(e.job_status, ''))) IN ('cancelled', 'canceled') THEN 'Cancelled'
      ELSE 'Pending'
    END,
    NULLIF(trim(concat_ws(' | ',
      CASE WHEN trim(coalesce(e.job_technician, '')) <> '' THEN concat('job_technician=', trim(e.job_technician)) END,
      CASE WHEN trim(coalesce(e.tire_technician, '')) <> '' THEN concat('tire_technician=', trim(e.tire_technician)) END,
      CASE WHEN trim(coalesce(e.electrician, '')) <> '' THEN concat('electrician=', trim(e.electrician)) END,
      CASE WHEN trim(coalesce(e.car_washer, '')) <> '' THEN concat('car_washer=', trim(e.car_washer)) END,
      CASE WHEN trim(coalesce(e.jobcard_complete_by, '')) <> '' THEN concat('jobcard_complete_by=', trim(e.jobcard_complete_by)) END,
      CASE WHEN trim(coalesce(e.order_status, '')) <> '' THEN concat('order_status=', trim(e.order_status)) END,
      CASE WHEN trim(coalesce(e.part_remarks, '')) <> '' THEN concat('part_remarks=', trim(e.part_remarks)) END,
      CASE WHEN trim(coalesce(e.lead_remarks, '')) <> '' THEN concat('lead_remarks=', trim(e.lead_remarks)) END
    )), ''),
    e.job_start::timestamptz,
    e.job_end::timestamptz,
    COALESCE(e.date_created::timestamptz, now()),
    COALESCE(e.date_modified::timestamptz, COALESCE(e.date_created::timestamptz, now())),
    NULLIF(trim(e.final_inspector), ''),
    CASE WHEN lower(trim(coalesce(e.final_insp_status, ''))) = 'completed' THEN e.job_end::timestamptz ELSE NULL END
  FROM migration.legacy_job_card_map_v2 jm
  JOIN migration.legacy_estimate_map_v2 em
    ON em.company_id = jm.company_id
   AND em.legacy_estimate_id = jm.legacy_estimate_id
  JOIN carguru2.estimates e
    ON e.id::bigint = em.legacy_estimate_id
  LEFT JOIN migration.legacy_lead_map lm
    ON lm.company_id = v_company_id
   AND lm.legacy_lead_id = em.legacy_lead_id
  WHERE jm.company_id = v_company_id
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'carguru2' AND table_name = 'line_items'
  ) THEN
    INSERT INTO migration.legacy_line_item_map_v2 (company_id, legacy_line_item_id, legacy_estimate_id, line_item_id)
    SELECT
      v_company_id,
      li.id::bigint,
      li.estimate_id::bigint,
      gen_random_uuid()
    FROM carguru2.line_items li
    JOIN migration.legacy_estimate_map_v2 em
      ON em.company_id = v_company_id
     AND em.legacy_estimate_id = li.estimate_id::bigint
    ON CONFLICT (company_id, legacy_line_item_id) DO NOTHING;

    INSERT INTO public.line_items (
      id,
      company_id,
      lead_id,
      inspection_id,
      product_name,
      description,
      quantity,
      reason,
      status,
      media_file_id,
      created_at,
      updated_at,
      part_ordered,
      order_status,
      source,
      job_card_id,
      part_pic,
      is_add,
      approved_type,
      customer_approval_status
    )
    SELECT
      lm.line_item_id,
      v_company_id,
      leadm.lead_id,
      em.inspection_id,
      NULLIF(trim(li.name), ''),
      NULLIF(trim(concat_ws(' | ',
        NULLIF(li.description, ''),
        NULLIF(li.insp_description, ''),
        NULLIF(li.agent_remarks, '')
      )), ''),
      GREATEST(COALESCE(li.quantity, 1), 1),
      CASE
        WHEN lower(trim(coalesce(li.type, ''))) LIKE '%mandatory%' THEN 'Mandatory'
        WHEN COALESCE(li.additional, false) THEN 'Additional'
        ELSE NULL
      END,
      CASE
        WHEN lower(trim(coalesce(li.status, ''))) IN ('done', 'completed', 'complete') THEN 'Done'
        WHEN lower(trim(coalesce(li.status, ''))) IN ('in progress', 'in_progress', 'working') THEN 'In Progress'
        ELSE 'Pending'
      END,
      NULLIF(trim(li.ins_pic), ''),
      COALESCE(li.date_created::timestamptz, now()),
      COALESCE(li.date_created::timestamptz, now()),
      CASE WHEN COALESCE(li.part_ordered, false) THEN 1 ELSE 0 END,
      CASE
        WHEN lower(trim(coalesce(li.po_status, ''))) = 'ordered' THEN 'Ordered'
        WHEN lower(trim(coalesce(li.po_status, ''))) IN ('received', 'recd', 'received ') THEN 'Received'
        WHEN lower(trim(coalesce(li.po_status, ''))) = 'returned' THEN 'Returned'
        ELSE 'Pending'
      END,
      'estimate',
      jm.job_card_id,
      NULLIF(trim(li.part_before), ''),
      CASE WHEN COALESCE(li.additional, false) THEN 1 ELSE 0 END,
      CASE
        WHEN lower(trim(coalesce(li.approve_type, ''))) IN ('oe', 'oem', 'aftm', 'used') THEN lower(trim(li.approve_type))
        ELSE NULL
      END,
      'pending'
    FROM migration.legacy_line_item_map_v2 lm
    JOIN carguru2.line_items li
      ON li.id::bigint = lm.legacy_line_item_id
    JOIN migration.legacy_estimate_map_v2 em
      ON em.company_id = lm.company_id
     AND em.legacy_estimate_id = lm.legacy_estimate_id
    LEFT JOIN migration.legacy_job_card_map_v2 jm
      ON jm.company_id = em.company_id
     AND jm.legacy_estimate_id = em.legacy_estimate_id
    LEFT JOIN migration.legacy_lead_map leadm
      ON leadm.company_id = em.company_id
     AND leadm.legacy_lead_id = em.legacy_lead_id
    WHERE lm.company_id = v_company_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

SELECT
  (SELECT COUNT(*) FROM carguru2.estimates) AS legacy_estimates,
  (SELECT COUNT(*) FROM migration.legacy_estimate_map_v2 WHERE company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS mapped_estimates,
  (SELECT COUNT(*) FROM public.estimates e JOIN migration.legacy_estimate_map_v2 m ON m.estimate_id=e.id AND m.company_id=e.company_id WHERE e.company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_estimates,
  (SELECT COUNT(*) FROM public.job_cards jc JOIN migration.legacy_job_card_map_v2 jm ON jm.job_card_id=jc.id WHERE jm.company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_job_cards,
  (SELECT COUNT(*) FROM public.line_items li JOIN migration.legacy_line_item_map_v2 lm ON lm.line_item_id=li.id AND lm.company_id=li.company_id WHERE li.company_id = NULLIF(current_setting('app.migration_company_id', true), '')::uuid) AS inserted_line_items;
