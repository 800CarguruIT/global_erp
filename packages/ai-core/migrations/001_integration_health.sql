DO $$
BEGIN
  -- Only run IF the table exists (table gets created later in migration 031)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'integration_dialers'
  ) THEN

    -- Add metadata column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'integration_dialers' AND column_name = 'metadata'
    ) THEN
      ALTER TABLE integration_dialers
        ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Add webhooks column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'integration_dialers' AND column_name = 'webhooks'
    ) THEN
      ALTER TABLE integration_dialers
        ADD COLUMN webhooks jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;

  END IF;
END $$;
