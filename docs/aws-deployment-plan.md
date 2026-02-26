# AWS Deployment Plan (GitHub + Dev/Staging/Production)

Who should read this?
- DevOps and backend engineers deploying Global ERP on AWS.

## 1. Target architecture

- Source: GitHub repository (this monorepo).
- Build/deploy pipeline: GitHub Actions.
- Container registry: Amazon ECR.
- Runtime: Amazon ECS Fargate (one service per environment).
- App load balancing: Application Load Balancer (ALB) with HTTPS.
- Database: Amazon RDS for PostgreSQL (or Aurora PostgreSQL if you need higher scale).
- Secrets: AWS Secrets Manager + SSM Parameter Store.
- DNS and certificates: Route 53 + AWS Certificate Manager (ACM).
- Logs/metrics: CloudWatch Logs + CloudWatch Alarms.

Current project notes:
- App starts with `node server.mjs start --port 3000` (`apps/web/server.mjs`), not plain `next start`.
- WebSocket endpoint is `/ws/call-center/incoming`, so ALB and target group must support upgrade requests.
- Local DB currently uses PostgreSQL and `DATABASE_URL`.

## 2. Environment flavor design

Use isolated stacks per flavor:

- `dev`
- `staging`
- `production`

Recommended naming:
- ECS cluster/services: `global-erp-dev`, `global-erp-staging`, `global-erp-prod`.
- ECR repos: `global-erp/web`.
- RDS instances: `global-erp-dev-db`, `global-erp-staging-db`, `global-erp-prod-db`.
- Domains:
  - `dev.yourdomain.com`
  - `staging.yourdomain.com`
  - `app.yourdomain.com` (production)

Isolation rules:
- Separate DB per environment (do not share schemas between prod/non-prod).
- Separate secrets per environment.
- Separate ECS services/target groups.
- Separate webhook endpoints per environment.

## 3. Step-by-step implementation

## Step 1: Prepare AWS foundation

- Create VPC across at least 2 AZs.
- Public subnets: ALB + NAT gateways.
- Private subnets: ECS tasks + RDS.
- Security groups:
  - ALB SG: allow `80/443` from internet.
  - ECS SG: allow app port (e.g., `3000`) only from ALB SG.
  - RDS SG: allow `5432` only from ECS SG.

## Step 2: Containerize app for production

- Add a production Dockerfile for monorepo build + runtime.
- Ensure runtime command is:
  - `pnpm --filter web start` (which runs `node server.mjs start --port 3000`).
- Add `.dockerignore` to reduce image size.
- Verify required runtime env vars are injected (not baked in image).

## Step 3: Provision PostgreSQL

- Create one RDS PostgreSQL instance per environment.
- Enable automated backups, PITR, and Multi-AZ for production.
- Store DB credentials and URL in Secrets Manager.
- Set `DATABASE_URL` in ECS task definition from secret reference.

Migration strategy:
- Run `pnpm db:migrate` during deployment before traffic cutover.
- Block app rollout if migrations fail.
- Take DB snapshot before production migration.

## Step 4: Configure ECS services

- Create ECS Fargate task definition for `web` container.
- Container port: `3000`.
- Health check endpoint: add/use a lightweight path (for example `/api/health`) and configure ALB target group health check.
- Set environment-specific task size:
  - dev: small
  - staging: medium
  - production: medium/large with autoscaling

## Step 5: Configure ALB for HTTP + WebSocket

- Listener `443` with ACM certificate.
- Forward traffic to ECS target group.
- Keep idle timeout high enough for WebSocket (for example 120-300s based on behavior).
- Ensure `/ws/*` stays on same target during active connection (ALB handles this per connection).

WebSocket-specific check:
- Validate `wss://<env-domain>/ws/call-center/incoming?companyId=...` connects and stays alive.
- Verify reconnect behavior when ECS task is restarted.

## Step 6: Setup GitHub Actions CI/CD

Per push:
- Run lint and type checks.
- Build Docker image.
- Push image to ECR.
- Deploy to ECS.

Branch-to-environment mapping:
- `develop` -> `dev`
- `staging` -> `staging`
- `main` -> `production` (optionally require manual approval)

Suggested workflow stages:
1. `test` (lint/typecheck/build)
2. `image` (build + scan + push)
3. `migrate` (run DB migrations)
4. `deploy` (update ECS service)
5. `smoke` (health + login + websocket probe)

## Step 7: Domain and DNS setup

- Register/host zone in Route 53.
- Create ACM certificate for:
  - `app.yourdomain.com`
  - `staging.yourdomain.com`
  - `dev.yourdomain.com`
- Validate certificate via DNS records.
- Create Route 53 `A/AAAA` alias records to each ALB.
- Enforce HTTPS redirect (HTTP 80 -> 443).

## Step 8: Observability and operations

- Send container logs to CloudWatch with environment labels.
- Add alarms:
  - ECS task unhealthy count
  - ALB `5XX`
  - high p95 latency
  - RDS CPU/storage/connections
- Add uptime synthetic checks for each environment.

## 4. CORS, cookies, and security blocks to watch

This project mostly works same-origin (UI + API on same host). CORS breaks mainly appear for mobile apps, cross-subdomain APIs, or third-party integrations.

Potential blockers:

- Missing CORS headers on API routes when called cross-origin.
- `OPTIONS` preflight not handled for custom headers.
- Credentials mode mismatch (`credentials: include` on client but no `Access-Control-Allow-Credentials: true`).
- Using wildcard origin (`*`) with credentials (invalid by browser rules).
- Cookie scope issues across subdomains (`Domain`, `Secure`, `SameSite`).
- Mixed-content issues: `ws://` from HTTPS pages must be `wss://`.
- CSRF risk if opening CORS too broadly.

Recommended CORS policy:

- Production allowlist only:
  - `https://app.yourdomain.com`
  - `https://staging.yourdomain.com` (only on staging APIs)
  - `https://dev.yourdomain.com` (only on dev APIs)
- Explicitly allow methods and headers used by app/mobile.
- Handle preflight requests centrally.
- If mobile app calls APIs directly, add mobile app origin(s) explicitly.

## 5. WebSocket-specific deployment risks

- ALB/NLB mismatch: use ALB with proper HTTP/1.1 upgrade support.
- Idle timeout too short causes disconnect loops.
- Task restarts drop active sockets (client must auto-reconnect).
- Horizontal scaling can change event timing because some events are in-process and others are DB-polled; verify near-real-time expectations under load.
- If strict ordering is required at scale, consider moving event fanout to Redis pub/sub or SNS/SQS + worker instead of process-local bus only.

## 6. Database risks and controls

- Migration drift between environments.
- Long-running locks during schema changes.
- Missing backup restore drill.
- Unbounded connection usage from ECS tasks.

Controls:

- Enforce migration in CI before deploy.
- Use migration windows for production.
- Set connection pool limits in app.
- Run quarterly restore test from snapshot.

## 7. Release/rollback procedure

Deployment:
1. Merge to target branch.
2. CI builds image and pushes to ECR.
3. Run migrations.
4. Update ECS service with new image tag.
5. Run smoke tests (login, key APIs, WebSocket).

Rollback:
1. Re-deploy previous known-good image tag.
2. If migration is backward incompatible, execute predefined rollback SQL or restore snapshot.
3. Confirm ALB healthy targets and business-critical flows.

## 8. Pre-go-live checklist (production)

- [ ] Production secrets stored only in Secrets Manager/SSM.
- [ ] RDS backups + retention + restore test verified.
- [ ] HTTPS active with valid ACM cert.
- [ ] WebSocket tested through ALB using `wss://`.
- [ ] CORS allowlist validated with browser and mobile clients.
- [ ] CloudWatch alarms connected to notification channel.
- [ ] Runbook documents on-call steps for deploy/rollback.

