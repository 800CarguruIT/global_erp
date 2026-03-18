# Prod to Dev Database Migration Runbook

This runbook copies data from production DB (`global_erp_prod`) into development DB (`global_erp_dev`) on the VPS.

Use this when you need fresh dev data for testing.

## 1) Preconditions

Run these on the VPS in the project directory:

```bash
cd /opt/global-erp
mkdir -p backups
```

## 2) Backup Development DB (mandatory)

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d global_erp_dev --no-owner --no-privileges \
  > backups/dev-before-sync-$(date +%F-%H%M).sql
```

## 3) Dump Production DB

```bash
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d global_erp_prod --no-owner --no-privileges \
  > backups/prod-to-dev-$(date +%F-%H%M).sql
```

## 4) Restore Dump into Development DB

Stop web first to avoid app writes during restore:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development stop web
```

Drop and recreate `global_erp_dev`:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS global_erp_dev;"
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE global_erp_dev;"
```

Restore:

```bash
cat backups/prod-to-dev-*.sql | docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec -T postgres \
  psql -U "$POSTGRES_USER" -d global_erp_dev
```

## 5) Start Dev and Apply Latest Migrations

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development up -d web
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:migrate
```

## 6) Customer Type Preservation (`Regular` / `CHSC`)

Legacy mapping scripts were updated to preserve customer type values:

- `scripts/migration/04_map_customers.sql`
- `scripts/migration/06b_leads_customer_fallback.sql`

Expected behavior:

- CHSC-like legacy values map to `CHSC`
- all others map to `Regular`

If legacy data was migrated before this fix, run this one-time correction:

```sql
UPDATE public.customers c
SET
  customer_type = CASE
    WHEN lower(trim(coalesce(src.type, ''))) IN ('chsc', 'customer happiness service contract', 'service contract') THEN 'CHSC'
    ELSE 'Regular'
  END,
  updated_at = now()
FROM migration.legacy_customer_map m
JOIN carguru2.customers src
  ON src.id::bigint = m.legacy_customer_id
WHERE c.id = m.customer_id
  AND c.company_id = m.company_id;
```

## 7) Validation Queries

Check customer type distribution in dev:

```sql
SELECT customer_type, COUNT(*) 
FROM public.customers
GROUP BY customer_type
ORDER BY customer_type;
```

Spot-check CHSC records:

```sql
SELECT id, code, name, customer_type, updated_at
FROM public.customers
WHERE customer_type = 'CHSC'
ORDER BY updated_at DESC
LIMIT 20;
```

## 8) Rollback

If restore is wrong, recover dev from backup:

```bash
cat backups/dev-before-sync-YYYY-MM-DD-HHMM.sql | docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec -T postgres \
  psql -U "$POSTGRES_USER" -d global_erp_dev
```

## Notes

- For this sync, use explicit DB names `global_erp_prod` and `global_erp_dev`.
- `POSTGRES_DB` in env files can differ from compose DB names; do not rely on it for cross-environment sync commands.
- Do not run this flow on production DB as target.
