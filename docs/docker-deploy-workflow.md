# Global ERP Ubuntu VPS Docker Deployment (Dev + Prod)

This guide configures one Ubuntu VPS with two environments:

- Production: `https://domain.com` -> Docker prod app on `127.0.0.1:3000`
- Development: `https://dev.prod.com` -> Docker dev app on `127.0.0.1:3001`

## 1) Server prerequisites (Ubuntu)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg ufw git
```

Install Docker Engine + Compose plugin:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and in again so `docker` works without `sudo`.

## 2) Firewall and base hardening

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

## 3) Clone project on VPS

```bash
sudo mkdir -p /opt
sudo chown -R $USER:$USER /opt
git clone <YOUR_REPO_URL> /opt/global-erp
cd /opt/global-erp
```

## 4) Environment files (dev + prod)

Create from templates:

```bash
cp .env.development.example .env.development
cp .env.production.example .env.production
```

Set development values in `.env.development`:

```env
POSTGRES_USER=autoguru
POSTGRES_PASSWORD=strong-dev-password
POSTGRES_DB=global_erp_dev
AUTH_SECRET=dev-long-random-secret
OPENAI_API_KEY=<dev-key-or-shared-key>
NEXT_PUBLIC_BASE_URL=https://dev.prod.com
WEB_BASE_URL=https://dev.prod.com
NEXT_PUBLIC_WEB_BASE_URL=https://dev.prod.com
```

Set production values in `.env.production`:

```env
POSTGRES_USER=autoguru
POSTGRES_PASSWORD=very-strong-prod-password
POSTGRES_DB=global_erp
AUTH_SECRET=prod-long-random-secret
OPENAI_API_KEY=<prod-key>
NEXT_PUBLIC_BASE_URL=https://domain.com
WEB_BASE_URL=https://domain.com
NEXT_PUBLIC_WEB_BASE_URL=https://domain.com
```

Rules:

- Use different DB names/passwords for dev and prod.
- Use different `AUTH_SECRET` for dev and prod.
- Never commit `.env.development` or `.env.production`.

## 5) Database configuration in Docker

Current compose files create separate Postgres containers and volumes:

- Dev DB: service `global-erp-postgres-dev`, volume `postgres_dev_data`
- Prod DB: service `global-erp-postgres`, volume `postgres_data`

Start development stack first:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build
```

Run migrations on development DB:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:migrate
```

Optional seed (development only):

```bash
docker compose -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:seed
```

Start production stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Run production migration:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web pnpm db:migrate
```

## 6) DNS and domain mapping

Create DNS records:

- `A` `domain.com` -> `<VPS_PUBLIC_IP>`
- `A` `www.domain.com` -> `<VPS_PUBLIC_IP>`
- `A` `dev.prod.com` -> `<VPS_PUBLIC_IP>`

## 7) Nginx reverse proxy + SSL

Install Nginx:

```bash
sudo apt install -y nginx
```

Install site config from repo:

```bash
sudo cp deploy/nginx/global-erp.conf /etc/nginx/sites-available/global-erp
sudo ln -s /etc/nginx/sites-available/global-erp /etc/nginx/sites-enabled/global-erp
sudo nginx -t
sudo systemctl reload nginx
```

Install certbot and issue certificates:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain.com -d www.domain.com -d dev.prod.com
```

## 8) Validate environments

Development checks:

- `https://dev.prod.com` loads
- Login works
- Key pages/APIs work
- Uploads work
- Logs clean: `docker compose -f docker-compose.dev.yml logs -f web`

Production checks:

- `https://domain.com` loads
- Login works
- Critical workflows pass
- Logs clean: `docker compose -f docker-compose.prod.yml logs -f web`

## 9) Release flow (test first, then go live)

On your local machine:

```bash
git add .
git commit -m "your update"
git push origin main
```

On VPS:

```bash
cd /opt/global-erp
git fetch --all
git checkout main
git pull origin main
```

Deploy to development:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build
docker compose -f docker-compose.dev.yml --env-file .env.development exec web pnpm db:migrate
```

After dev approval, deploy same commit to production:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec web pnpm db:migrate
```

## 10) Backup and restore (PostgreSQL)

Backup production DB:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > backup-prod-$(date +%F-%H%M).sql
```

Restore (dangerous, overwrites data):

```bash
cat backup-file.sql | docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## 11) Rollback

Recommended:

1. Deploy using Git tags/commits.
2. If release fails, checkout previous tag and redeploy.
3. If migration is incompatible, restore DB backup before retry.

Example:

```bash
git checkout <PREVIOUS_TAG>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 12) Useful commands

Check running containers:

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.prod.yml ps
```

Restart web only:

```bash
docker compose -f docker-compose.dev.yml restart web
docker compose -f docker-compose.prod.yml restart web
```

Tail logs:

```bash
docker compose -f docker-compose.dev.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f web
```
