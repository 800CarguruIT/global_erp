-- Shows which tables can be mapped from carguru2 -> public using shared column names.
WITH src AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'carguru2'
),
tgt AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
shared AS (
  SELECT s.table_name, s.column_name
  FROM src s
  INNER JOIN information_schema.columns t
    ON t.table_name = s.table_name
   AND t.column_name = s.column_name
   AND t.table_schema = 'public'
  INNER JOIN information_schema.columns sc
    ON sc.table_schema = 'carguru2'
   AND sc.table_name = s.table_name
   AND sc.column_name = s.column_name
  WHERE (
    (sc.udt_schema = t.udt_schema AND sc.udt_name = t.udt_name)
    OR EXISTS (
      SELECT 1
      FROM pg_cast pc
      WHERE pc.castsource = to_regtype(format('%I.%I', sc.udt_schema, sc.udt_name))
        AND pc.casttarget = to_regtype(format('%I.%I', t.udt_schema, t.udt_name))
        AND pc.castcontext IN ('a', 'i')
    )
  )
),
required_missing AS (
  SELECT
    c.table_name,
    count(*) AS missing_required_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.is_nullable = 'NO'
    AND c.column_default IS NULL
    AND c.is_identity = 'NO'
    AND c.is_generated = 'NEVER'
    AND NOT EXISTS (
      SELECT 1
      FROM shared sh
      WHERE sh.table_name = c.table_name
        AND sh.column_name = c.column_name
    )
  GROUP BY c.table_name
)
SELECT
  sh.table_name,
  count(*) AS shared_cols,
  COALESCE(rm.missing_required_cols, 0) AS missing_required_cols
FROM shared sh
LEFT JOIN required_missing rm
  ON rm.table_name = sh.table_name
GROUP BY sh.table_name, rm.missing_required_cols
ORDER BY shared_cols DESC, sh.table_name;
