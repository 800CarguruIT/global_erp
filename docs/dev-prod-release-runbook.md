# Dev/Prod Release Runbook

This runbook is for releasing Global ERP changes from local -> `dev` -> `prod` with minimal risk.

Use this for normal feature releases (including inspection, estimate approval, invoice conversion, wallet topup, and auto car-out flow).

---

## 1) Pre-Release Checklist (Local)

From repo root:

```bash
pnpm install
pnpm check-types
pnpm build
```

If schema changed:

```bash
pnpm db:migrate
```

Commit and push:

```bash
git add .
git commit -m "release: <short summary>"
git push origin main
```

---

## 2) Deploy to Development

SSH to server and pull latest:

```bash
cd /opt/global-erp
git pull origin main
```

Rebuild/restart dev:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development up -d --build
```

Run migrations in dev:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:migrate
```

Check status/logs:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml ps
docker compose -p global-erp-dev -f docker-compose.dev.yml logs --tail=200 web
```

---

## 3) Dev Smoke Test (Mandatory)

Validate these before prod:

1. Inspection -> estimate -> customer approval link opens and loads line-item prices.
2. Customer approval + signature persists after refresh.
3. Estimate page reflects approved type/selected sale correctly.
4. Invoice Verification modal shows:
   - line items,
   - totals,
   - wallet balance block.
5. If wallet insufficient:
   - `Top Up Wallet` modal opens,
   - topup amount cannot be below invoice required amount,
   - topup saves.
6. Convert invoice:
   - if grand total is `0` OR wallet is sufficient -> invoice auto-paid and car-out gatepass created.
   - if wallet insufficient -> invoice created only, no auto car-out.
7. Job card and PO creation still work after customer approval/sign.

---

## 4) Deploy to Production

After dev signoff:

```bash
cd /opt/global-erp
git pull origin main
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production exec web pnpm db:migrate
```

Check status/logs:

```bash
docker compose -p global-erp-prod -f docker-compose.prod.yml ps
docker compose -p global-erp-prod -f docker-compose.prod.yml logs --tail=200 web
```

---

## 5) Production Validation (Quick)

1. Login works on `https://globalerp.ai`.
2. Open one approved estimate and verify Invoice Verification modal renders correctly.
3. Test one low-risk invoice convert:
   - check invoice status,
   - check paid state behavior,
   - check gatepass creation rule.
4. Check server logs for 5xx errors in:
   - `/api/public/estimate-approval/[token]`
   - `/api/company/[companyId]/workshop/invoices`

---

## 6) Rollback Plan

If production issue occurs:

1. Revert commit on `main` (recommended):

```bash
git revert <bad_commit_sha>
git push origin main
```

2. Pull and redeploy prod:

```bash
cd /opt/global-erp
git pull origin main
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production up -d --build
```

3. If migration caused issue, apply a forward-fix migration (do not edit old applied migrations).

---

## 7) Notes

- Keep `dev` and `prod` env values separate (`.env.development` vs `.env.production`).
- Always run migrations against dev first.
- Never skip smoke test for customer approval -> invoice convert path.
