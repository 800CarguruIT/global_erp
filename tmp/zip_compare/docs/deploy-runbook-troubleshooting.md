# Global ERP Deployment Runbook (Ubuntu VPS + Docker) with Troubleshooting

This runbook is based on the actual deployment flow used for Global ERP with:

- Production: `https://globalerp.ai`
- Development: `https://dev.globalerp.ai`

It includes both:

1. Standard deployment steps
2. Real issues faced during deployment and exact fixes

---

## 1) Prerequisites on Ubuntu VPS

Install Docker + Compose plugin:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg ufw git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Re-login shell after group change.

Optional firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 2) Clone and prepare project

```bash
git clone <REPO_URL> /opt/global-erp
cd /opt/global-erp
```

Create env files:

```bash
cp .env.development.example .env.development
cp .env.production.example .env.production
```

Recommended DB split:

- Dev DB: `global_erp_dev`
- Prod DB: `global_erp`

---

## 3) Run dev and prod as separate compose projects

Always use explicit project names to avoid collisions.

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development up -d --build
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Check:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml ps
docker compose -p global-erp-prod -f docker-compose.prod.yml ps
```

---

## 4) Migrations and bootstrap

Dev:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:migrate
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:bootstrap:minimal
```

Prod:

```bash
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production exec web pnpm db:migrate
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production exec web pnpm db:bootstrap:minimal
```

---

## 5) DNS, Nginx, SSL

### DNS (GoDaddy)

Set:

- `A @` -> `<ELASTIC_IP>`
- `CNAME www` -> `globalerp.ai`
- `A dev` -> `<ELASTIC_IP>`

Verify:

```bash
nslookup globalerp.ai
nslookup dev.globalerp.ai
```

### Nginx config

Use server names:

- `globalerp.ai www.globalerp.ai` -> `127.0.0.1:3000`
- `dev.globalerp.ai` -> `127.0.0.1:3001`

Enable site and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/global-erp /etc/nginx/sites-enabled/global-erp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### SSL

```bash
sudo certbot --nginx -d globalerp.ai -d www.globalerp.ai -d dev.globalerp.ai
```

---

## 6) Release flow (Dev -> Prod)

Local:

```bash
git add .
git commit -m "update"
git push origin main
```

VPS:

```bash
cd /opt/global-erp
git pull origin main
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development up -d --build
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:migrate
```

After dev validation:

```bash
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production exec web pnpm db:migrate
```

---

## 7) Issues Faced and Solutions

### A) `docker-compose.dev.yml` / `.env.*.example` not found
Cause: files created locally but not pushed.  
Fix: push changes from local repo, then `git pull` on VPS.

### B) `failed to read dockerfile: open Dockerfile: no such file`
Cause: Dockerfile missing on VPS checkout.  
Fix: ensure Dockerfile exists in repo and pull latest.

### C) Port conflict (`8081 already allocated`)
Cause: old Adminer container already bound port.  
Fix: stop/remove old container or change port mapping.

### D) Can’t access app from browser, timeout
Cause: SG/UFW missing rules.  
Fix: allow required ports in AWS SG and UFW.  
For direct test allow `3000/3001`; for domain mode allow `80/443`.

### E) Prod build fails: module not found
Cause: invalid relative imports in routes.  
Fix: switch route imports to stable alias `@/lib/...`.

### F) Prod build fails: `OPENAI_API_KEY is not set`
Cause: key required during `next build` path evaluation.  
Fix: set valid key in `.env.production` and pass build-time env/args.

### G) `Need to specify how to reconcile divergent branches`
Cause: local commits on VPS diverged.  
Fix: use `git pull --rebase origin main` or clean reset policy.

### H) `.pnpm-store` permission/unlink errors during pull
Cause: root-owned files in repo dir from previous operations.  
Fix:

```bash
git rebase --abort || true
sudo chown -R $USER:$USER /opt/global-erp
rm -rf /opt/global-erp/.pnpm-store
```

### I) Container name conflicts (`global-erp-web` / `global-erp-postgres`)
Cause: fixed `container_name` shared between dev/prod.  
Fix: unique names or remove `container_name`; use `-p global-erp-dev` and `-p global-erp-prod`.

### J) `service "web" is not running` during `exec`
Cause: command run without matching project name.  
Fix: always include same `-p` used during `up`.

### K) Migration error: `relation "accounting_entities" does not exist`
Cause: migration order mismatch around accounting migrations.  
Fix: apply manual SQL patch for `accounting_entities`, then rerun migrate.

### L) Migration error: `column "code" ... accounting_accounts does not exist`
Cause: `accounting_accounts` missing modern columns before seed migration.  
Fix: add required columns (`code`, `name`, `type`, etc.) manually, then rerun migrate.

### M) `database "global_erp" does not exist`
Cause: existing Postgres volume initialized with different DB.  
Fix: create DB manually with `psql -d postgres -c "CREATE DATABASE global_erp;"`.

### N) `password authentication failed for user "autoguru"`
Cause: mismatch between `DATABASE_URL` and DB user password.  
Fix: align `.env.production` + `ALTER USER autoguru WITH PASSWORD ...`; recreate `web`.

### O) Login loops back to `/auth/login` on HTTP
Cause: secure cookie in production (`secure=true`) not sent over HTTP.  
Fix: use HTTPS domain via Nginx + certbot.

### P) Certbot cannot find matching server block
Cause: nginx `server_name` placeholders not updated.  
Fix: set real names (`globalerp.ai`, `www.globalerp.ai`, `dev.globalerp.ai`) and reload nginx.

### Q) Logout redirected to container hostname
Cause: logout redirect derived from internal request host.  
Fix: update logout API logic and set:

- prod `WEB_BASE_URL=https://globalerp.ai`
- dev `WEB_BASE_URL=https://dev.globalerp.ai`

### R) Directly opening logout URL logs user out
Cause: `GET /api/auth/logout` allowed.  
Fix: allow logout only via `POST`; return `405` on `GET`.

---

## 8) Quick verification commands

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development ps
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production ps
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development logs -f web
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production logs -f web
```

Check active DB target from each app container:

```bash
docker compose -p global-erp-dev -f docker-compose.dev.yml --env-file .env.development exec web sh -lc 'echo $DATABASE_URL'
docker compose -p global-erp-prod -f docker-compose.prod.yml --env-file .env.production exec web sh -lc 'echo $DATABASE_URL'
```
