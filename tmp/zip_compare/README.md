# Global ERP Monorepo

Production-oriented automotive workshop ERP built with Next.js, React, TypeScript, Turborepo, PostgreSQL, and OpenAI-backed features.

## Included apps/packages

- `apps/web` — main Next.js application
- `packages/ai-core` — backend services, DB access, AI integrations
- `packages/ai-tools` — AI tool definitions
- `packages/ui` — shared UI components/charts

## Requirements

- Node 20+
- pnpm 9
- PostgreSQL 16+

## Install

```bash
npx -y pnpm@9.0.0 install --frozen-lockfile
```

## Local development

```bash
npx -y pnpm@9.0.0 dev
```

## Type-check

```bash
npx -y pnpm@9.0.0 check-types
```

## Build web app

```bash
npx -y pnpm@9.0.0 --filter web build
```

## Database bootstrap

Minimal bootstrap:

```bash
npx -y pnpm@9.0.0 db:bootstrap:minimal
```

Full demo seed:

```bash
npx -y pnpm@9.0.0 db:seed
```

## Default bootstrap/demo logins

- `admin@bootstrap.test` / `Admin@123`
- `admin@demo.test` / `Admin@123`

Change these immediately outside development/test environments.

## Production deployment

Use the production compose file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Then validate:

- `/api/health`
- login flow
- at least one company dashboard page
- at least one protected API route
- uploads/log volume permissions

## Important security notes

This codebase has had a hardening pass, but you should still review before public deployment:

- `apps/web/next.config.js` still has `typescript.ignoreBuildErrors = true`
- rate limiting is in-memory
- validation coverage is uneven across routes
- external logging / error tracking is not wired by default

See `DEPLOY_FINAL.md` for the final deployment notes from this pass.
