-- Custom mapping for legacy carguru2 flow:
-- legacy estimates (single table job metadata) -> public.estimates + public.job_cards (+ public.line_items)
-- Relation target: one estimate can have many job_cards.
--
-- Optional runtime setting:
--   SET app.migration_default_company_id = 'your-company-uuid';

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.legacy_estimate_map (
  legacy_estimate_id bigint PRIMARY KEY,
  estimate_id uuid NOT NULL UNIQUE,
  inspection_id uuid NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration.legacy_job_card_map (
  legacy_line_item_id bigint PRIMARY KEY,
  legacy_estimate_id bigint NOT NULL,
  job_card_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration.legacy_line_item_map (
  legacy_line_item_id bigint PRIMARY KEY,
  line_item_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_default_company uuid;
BEGIN
  BEGIN
    v_default_company := NULLIF(current_setting('app.migration_default_company_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_default_company := NULL;
  END;

  IF v_default_company IS NULL THEN
    SELECT c.id
      INTO v_default_company
    FROM public.companies c
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_default_company IS NULL THEN
    RAISE EXCEPTION 'No company found. Set app.migration_default_company_id or create one company.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'carguru2'
      AND table_name = 'estimates'
  ) THEN
    RAISE EXCEPTION 'carguru2.estimates not found. Run pgloader first.';
  END IF;

  INSERT INTO migration.legacy_estimate_map (legacy_estimate_id, estimate_id, inspection_id, company_id)
  SELECT e.id::bigint, gen_random_uuid(), gen_random_uuid(), v_default_company
  FROM carguru2.estimates e
  WHERE NOT EXISTS (
    SELECT 1
    FROM migration.legacy_estimate_map m
    WHERE m.legacy_estimate_id = e.id::bigint
  );

  INSERT INTO public.inspections (
    id, company_id, status, customer_remark, inspector_remark, created_at, updated_at
  )
  SELECT
    m.inspection_id,
    m.company_id,
    CASE
      WHEN e.job_end IS NOT NULL THEN 'done'
      WHEN e.job_start IS NOT NULL THEN 'in_progress'
      ELSE 'pending'
    END,
    NULLIF(e.lead_remarks, ''),
    NULLIF(e.inspector_remarks, ''),
    COALESCE(e.date_created::timestamptz, now()),
    COALESCE(e.date_modified::timestamptz, COALESCE(e.date_created::timestamptz, now()))
  FROM migration.legacy_estimate_map m
  JOIN carguru2.estimates e
    ON e.id::bigint = m.legacy_estimate_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.estimates (
    id,
    company_id,
    inspection_id,
    status,
    total_cost,
    total_sale,
    total_discount,
    grand_total,
    total_vat,
    total_subtotal,
    total_gp,
    vat_amount,
    final_price,
    invoice_status,
    payment_status,
    payment_method,
    invoice_date,
    created_at,
    updated_at,
    meta
  )
  SELECT
    m.estimate_id,
    m.company_id,
    m.inspection_id,
    COALESCE(NULLIF(e.estimate_status, ''), 'pending'),
    COALESCE(e.total_cost, 0)::numeric,
    COALESCE(e.total_sale, 0)::numeric,
    COALESCE(e.total_discount, 0)::numeric,
    COALESCE(e.grand_total, 0)::numeric,
    COALESCE(e.total_vat, 0)::numeric,
    COALESCE(e.total_subtotal, 0)::numeric,
    COALESCE(NULLIF(e.total_gp, ''), '0')::numeric,
    COALESCE(e.total_vat, 0)::numeric,
    COALESCE(e.grand_total, 0)::numeric,
    CASE
      WHEN e.invoice_date IS NOT NULL THEN 'Invoiced'
      ELSE 'Pending'
    END,
    CASE
      WHEN lower(COALESCE(e.invoice_status, '')) = 'paid' THEN 'Paid'
      WHEN lower(COALESCE(e.invoice_status, '')) = 'unpaid' THEN 'Unpaid'
      ELSE 'Pending'
    END,
    CASE
      WHEN lower(COALESCE(e.payment_method, '')) LIKE '%cash%' THEN 'Cash'
      WHEN lower(COALESCE(e.payment_method, '')) LIKE '%pos%' THEN 'POS'
      WHEN lower(COALESCE(e.payment_method, '')) LIKE '%bank%' THEN 'Bank Transfer'
      ELSE NULL
    END,
    e.invoice_date::timestamptz,
    COALESCE(e.date_created::timestamptz, now()),
    COALESCE(e.date_modified::timestamptz, COALESCE(e.date_created::timestamptz, now())),
    jsonb_build_object(
      'legacy', jsonb_build_object(
        'source_schema', 'carguru2',
        'estimate_id', e.id,
        'lead_id', e.lead_id,
        'car_id', e.car_id,
        'account_id', e.account_id
      )
    )
  FROM migration.legacy_estimate_map m
  JOIN carguru2.estimates e
    ON e.id::bigint = m.legacy_estimate_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO migration.legacy_job_card_map (legacy_line_item_id, legacy_estimate_id, job_card_id)
  SELECT li.id::bigint, li.estimate_id::bigint, gen_random_uuid()
  FROM carguru2.line_items li
  JOIN migration.legacy_estimate_map em
    ON em.legacy_estimate_id = li.estimate_id::bigint
  WHERE NOT EXISTS (
    SELECT 1
    FROM migration.legacy_job_card_map jm
    WHERE jm.legacy_line_item_id = li.id::bigint
  );

  INSERT INTO public.job_cards (
    id,
    estimate_id,
    lead_id,
    status,
    remarks,
    start_at,
    complete_at,
    created_at,
    updated_at
  )
  SELECT
    jm.job_card_id,
    em.estimate_id,
    pe.lead_id,
    CASE
      WHEN lower(COALESCE(li.status, '')) IN ('done', 'completed', 'complete') THEN 'Done'
      WHEN lower(COALESCE(li.status, '')) IN ('in progress', 'in_progress', 'working') THEN 'In Progress'
      ELSE 'Pending'
    END,
    NULLIF(trim(concat_ws(' | ', NULLIF(li.name, ''), NULLIF(li.description, ''), NULLIF(li.agent_remarks, ''))), ''),
    e.job_start::timestamptz,
    e.job_end::timestamptz,
    COALESCE(li.date_created::timestamptz, COALESCE(e.date_created::timestamptz, now())),
    COALESCE(e.date_modified::timestamptz, COALESCE(e.date_created::timestamptz, now()))
  FROM migration.legacy_job_card_map jm
  JOIN carguru2.line_items li
    ON li.id::bigint = jm.legacy_line_item_id
  JOIN carguru2.estimates e
    ON e.id::bigint = jm.legacy_estimate_id
  JOIN migration.legacy_estimate_map em
    ON em.legacy_estimate_id = jm.legacy_estimate_id
  LEFT JOIN public.estimates pe
    ON pe.id = em.estimate_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO migration.legacy_line_item_map (legacy_line_item_id, line_item_id)
  SELECT li.id::bigint, gen_random_uuid()
  FROM carguru2.line_items li
  JOIN migration.legacy_estimate_map em
    ON em.legacy_estimate_id = li.estimate_id::bigint
  WHERE NOT EXISTS (
    SELECT 1
    FROM migration.legacy_line_item_map lm
    WHERE lm.legacy_line_item_id = li.id::bigint
  );

  INSERT INTO public.line_items (
    id,
    company_id,
    lead_id,
    inspection_id,
    product_name,
    description,
    quantity,
    status,
    part_ordered,
    order_status,
    source,
    created_at,
    updated_at,
    is_add,
    approved_type,
    customer_approval_status,
    job_card_id
  )
  SELECT
    lm.line_item_id,
    em.company_id,
    pe.lead_id,
    em.inspection_id,
    NULLIF(li.name, ''),
    NULLIF(li.description, ''),
    GREATEST(COALESCE(li.quantity, 1), 1),
    CASE
      WHEN lower(COALESCE(li.status, '')) IN ('done', 'completed', 'complete') THEN 'Done'
      WHEN lower(COALESCE(li.status, '')) IN ('in progress', 'in_progress', 'working') THEN 'In Progress'
      ELSE 'Pending'
    END,
    CASE WHEN COALESCE(li.part_ordered, 0) <> 0 THEN 1 ELSE 0 END,
    COALESCE(NULLIF(li.po_status, ''), 'Pending'),
    'inspection',
    COALESCE(li.date_created::timestamptz, now()),
    COALESCE(li.date_created::timestamptz, now()),
    CASE WHEN COALESCE(li.additional, 0) <> 0 THEN 1 ELSE 0 END,
    NULLIF(li.approve_type, ''),
    'pending',
    jm.job_card_id
  FROM migration.legacy_line_item_map lm
  JOIN carguru2.line_items li
    ON li.id::bigint = lm.legacy_line_item_id
  JOIN migration.legacy_job_card_map jm
    ON jm.legacy_line_item_id = lm.legacy_line_item_id
  JOIN migration.legacy_estimate_map em
    ON em.legacy_estimate_id = li.estimate_id::bigint
  LEFT JOIN public.estimates pe
    ON pe.id = em.estimate_id
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT
  (SELECT count(*) FROM migration.legacy_estimate_map) AS mapped_estimates,
  (SELECT count(*) FROM migration.legacy_job_card_map) AS mapped_job_cards,
  (SELECT count(*) FROM migration.legacy_line_item_map) AS mapped_line_items,
  (SELECT count(*) FROM public.estimates e WHERE e.meta ? 'legacy') AS inserted_estimates,
  (SELECT count(*) FROM public.job_cards) AS total_job_cards,
  (SELECT count(*) FROM public.line_items) AS total_line_items;
