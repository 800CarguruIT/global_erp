DO $$
DECLARE
  v_company uuid := '916d368c-6dc5-4835-9f01-7394a60d431c'::uuid;
BEGIN
  INSERT INTO migration.legacy_customer_map (legacy_customer_id, customer_id, company_id)
  SELECT x.legacy_customer_id, gen_random_uuid(), v_company
  FROM (
    SELECT DISTINCT l.account_id::bigint AS legacy_customer_id
    FROM carguru2.leads l
    LEFT JOIN migration.legacy_customer_map cm
      ON cm.legacy_customer_id = l.account_id::bigint
     AND cm.company_id = v_company
    WHERE l.account_id <> 0
      AND cm.legacy_customer_id IS NULL
  ) x
  ON CONFLICT (legacy_customer_id) DO NOTHING;

  INSERT INTO public.customers (
    id, company_id, customer_type, code, name, notes, is_active, created_at, updated_at
  )
  SELECT
    cm.customer_id,
    v_company,
    'Regular',
    format('CU-LEG-MISS-%s', cm.legacy_customer_id),
    format('Legacy Missing Customer %s', cm.legacy_customer_id),
    format('Auto-created from legacy leads fallback | legacy_customer_id=%s', cm.legacy_customer_id),
    true,
    now(),
    now()
  FROM migration.legacy_customer_map cm
  LEFT JOIN public.customers c ON c.id = cm.customer_id
  WHERE cm.company_id = v_company
    AND c.id IS NULL;

  UPDATE public.leads l
  SET customer_id = cm.customer_id,
      updated_at = now()
  FROM migration.legacy_lead_map lm
  JOIN carguru2.leads cl
    ON cl.id::bigint = lm.legacy_lead_id
  JOIN migration.legacy_customer_map cm
    ON cm.legacy_customer_id = cl.account_id::bigint
   AND cm.company_id = lm.company_id
  WHERE l.id = lm.lead_id
    AND l.company_id = v_company
    AND lm.company_id = v_company
    AND l.customer_id IS NULL
    AND cl.account_id <> 0;
END $$;
