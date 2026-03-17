# System Context

Owner: Platform Engineering  
Last Updated: 2026-02-20  
Status: draft

## Purpose

Global ERP is a multi-tenant operations platform for automotive and service businesses.  
It centralizes company, branch, and vendor workflows across sales, workshop operations, inventory, procurement, accounting, HR, reporting, and integrations.

Primary goals:

- Provide one system of record for operational and financial workflows
- Enforce role-based access across global/company/branch/vendor scopes
- Expose web and mobile APIs for day-to-day execution
- Support operational automation through AI summaries and integration connectors

## External Actors

- Global admins
- Company admins and staff (sales, call center, workshop, inventory, accounting, HR)
- Branch users
- Vendor users
- Mobile app users (field/workshop workflows)
- External providers:
  - Messaging and channels (Twilio, Meta/WhatsApp, SMTP/Sendgrid, Firebase, GA4, Infobip, MessageBird)
  - Dialer providers
  - OpenAI (AI tooling/summaries)
  - File processing tools (Sharp, FFmpeg)

## Context Diagram (Mermaid)

```mermaid
flowchart LR
  G[Global Admins] --> WEB[Next.js Web App]
  C[Company/Branch/Vendor Users] --> WEB
  M[Mobile Clients] --> API[Mobile API Routes]
  WEB --> API[Next.js API Routes]
  API --> CORE[@repo/ai-core Services + Repositories]
  CORE --> DB[(PostgreSQL)]
  API --> FILES[File Storage: apps/web/data/uploads]
  API --> EXT[External Providers]
  EXT --> API
```

## Boundaries

In scope:

- Monorepo architecture:
  - `apps/web`: Next.js app (UI + API routes)
  - `packages/ai-core`: domain services, repositories, migrations
  - `packages/ui`: shared UI components and layouts
  - `packages/ai-tools`: AI tool adapters
- Core domains:
  - Auth and RBAC
  - Company, branch, vendor management
  - CRM/leads and call center
  - Workshop (inspections, estimates, work orders, quality checks, invoices, gatepass)
  - Procurement and inventory
  - Accounting and reporting
  - HR and user/session monitoring
  - Marketing templates/campaign support
- API namespaces:
  - `/api/auth/*`, `/api/mobile/*`, `/api/company/[companyId]/*`, `/api/global/*`
- Persistence and runtime:
  - PostgreSQL via `DATABASE_URL`
  - Cookie session (`ge_session`) with HMAC token using `AUTH_SECRET`
  - Node runtime for upload/processing endpoints

Out of scope:

- Third-party provider internal infrastructure and SLAs
- External BI/data warehouse pipelines not implemented in this repo
- Native mobile app codebase (this repo provides mobile-facing APIs, not client apps)
- Infrastructure-as-code for cloud deployment (not defined in current repository)

## Scope Model

The system resolves request scope from URL and permissions:

- `global`: cross-company administration and global dashboards
- `company`: company-level operations
- `branch`: branch-level execution workflows
- `vendor`: vendor portal and procurement interactions

This scope model drives navigation, module visibility, and access control.

## Data and Control Flow

1. User authenticates via `/api/auth/login`; server sets `ge_session` cookie.
2. Middleware validates presence of session cookie for protected routes.
3. API routes call `@repo/ai-core` service/repository modules.
4. ai-core reads/writes PostgreSQL, including domain-specific tables.
5. For media, upload API stores files under `apps/web/data/uploads`, optionally compresses/transcodes, and persists metadata in DB.
6. Integration routes read/write integration configs and invoke provider-specific behavior.

## Key Architectural Decisions (Current)

- Monorepo with shared packages to keep domain logic centralized and reused by web/API layers.
- Direct PostgreSQL access through the `postgres` client in ai-core.
- SQL migration files under `packages/ai-core/migrations` tracked via `schema_migrations`.
- Server-side sessions implemented with signed HMAC tokens in HTTP-only cookies.
- Documentation pages under `/global/docs` currently read Markdown files from the repository `docs/` directory.
