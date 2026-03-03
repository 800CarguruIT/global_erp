-- Generic mapper from carguru2 schema to public schema using same table/column names.
-- Optional runtime mode:
--   SET app.migration_mode = 'replace'; -- truncate target table first
--   SET app.migration_mode = 'append';  -- default

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.map_run_log (
  id bigserial PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL,
  table_name text NOT NULL,
  status text NOT NULL,
  rows_moved bigint NOT NULL DEFAULT 0,
  note text NULL
);

DO $$
DECLARE
  r RECORD;
  v_mode text := COALESCE(current_setting('app.migration_mode', true), 'append');
  v_cols text;
  v_insert_sql text;
  v_filter_sql text;
  v_pk_cols text[];
  v_pk_join text;
  v_required_missing integer;
  v_rows bigint;
BEGIN
  v_mode := lower(v_mode);
  IF v_mode NOT IN ('append', 'replace') THEN
    RAISE EXCEPTION 'Invalid app.migration_mode: %, expected append|replace', v_mode;
  END IF;

  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND EXISTS (
        SELECT 1
        FROM information_schema.tables s
        WHERE s.table_schema = 'carguru2'
          AND s.table_name = t.table_name
          AND s.table_type = 'BASE TABLE'
      )
    ORDER BY t.table_name
  LOOP
    SELECT count(*)
      INTO v_required_missing
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name
      AND c.is_nullable = 'NO'
      AND c.column_default IS NULL
      AND c.is_identity = 'NO'
      AND c.is_generated = 'NEVER'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns s
        WHERE s.table_schema = 'carguru2'
          AND s.table_name = r.table_name
          AND s.column_name = c.column_name
          AND (
            (s.udt_schema = c.udt_schema AND s.udt_name = c.udt_name)
            OR EXISTS (
              SELECT 1
              FROM pg_cast pc
              WHERE pc.castsource = to_regtype(format('%I.%I', s.udt_schema, s.udt_name))
                AND pc.casttarget = to_regtype(format('%I.%I', c.udt_schema, c.udt_name))
                AND pc.castcontext IN ('a', 'i')
            )
          )
      );

    IF v_required_missing > 0 THEN
      INSERT INTO migration.map_run_log(mode, table_name, status, note)
      VALUES (v_mode, r.table_name, 'skipped', 'missing required target columns');
      CONTINUE;
    END IF;

    SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO v_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns s
        WHERE s.table_schema = 'carguru2'
          AND s.table_name = r.table_name
          AND s.column_name = c.column_name
          AND (
            (s.udt_schema = c.udt_schema AND s.udt_name = c.udt_name)
            OR EXISTS (
              SELECT 1
              FROM pg_cast pc
              WHERE pc.castsource = to_regtype(format('%I.%I', s.udt_schema, s.udt_name))
                AND pc.casttarget = to_regtype(format('%I.%I', c.udt_schema, c.udt_name))
                AND pc.castcontext IN ('a', 'i')
            )
          )
      );

    IF v_cols IS NULL OR length(v_cols) = 0 THEN
      INSERT INTO migration.map_run_log(mode, table_name, status, note)
      VALUES (v_mode, r.table_name, 'skipped', 'no shared columns');
      CONTINUE;
    END IF;

    IF v_mode = 'replace' THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.table_name);
    END IF;

    SELECT array_agg(a.attname ORDER BY a.attnum)
      INTO v_pk_cols
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'public'
      AND c.relname = r.table_name
      AND i.indisprimary;

    v_filter_sql := '';
    IF v_mode = 'append' AND v_pk_cols IS NOT NULL AND array_length(v_pk_cols, 1) > 0 THEN
      SELECT string_agg(format('t.%1$I::text = s.%1$I::text', col), ' AND ')
        INTO v_pk_join
      FROM unnest(v_pk_cols) AS col
      WHERE EXISTS (
        SELECT 1
        FROM information_schema.columns s
        WHERE s.table_schema = 'carguru2'
          AND s.table_name = r.table_name
          AND s.column_name = col
      );

      IF v_pk_join IS NOT NULL AND length(v_pk_join) > 0 THEN
        v_filter_sql := format(' WHERE NOT EXISTS (SELECT 1 FROM public.%I t WHERE %s)', r.table_name, v_pk_join);
      END IF;
    END IF;

    v_insert_sql := format(
      'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM carguru2.%1$I s%3$s',
      r.table_name,
      v_cols,
      v_filter_sql
    );

    BEGIN
      EXECUTE v_insert_sql;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      INSERT INTO migration.map_run_log(mode, table_name, status, rows_moved)
      VALUES (v_mode, r.table_name, 'ok', COALESCE(v_rows, 0));
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO migration.map_run_log(mode, table_name, status, note)
      VALUES (v_mode, r.table_name, 'error', SQLSTATE || ': ' || SQLERRM);
    END;
  END LOOP;
END $$;

SELECT status, count(*) AS tables_count, sum(rows_moved) AS rows_total
FROM migration.map_run_log
WHERE run_at >= now() - interval '1 hour'
GROUP BY status
ORDER BY status;
