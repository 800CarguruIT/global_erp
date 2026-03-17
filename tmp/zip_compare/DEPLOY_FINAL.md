# Global ERP — Deployment Notes (Final Hardening Pass)

This bundle is the cleaned deployment target from the `final-delivery` archive.

## What was hardened here

- Middleware now clears expired/invalid session cookies instead of only redirecting.
- Public API middleware coverage widened to include the full `/api/public/*` namespace.
- Added same-origin protection for authenticated non-GET API requests in middleware.
- Session cookie lifetime now matches the 24-hour signed session token lifetime.
- `/api/health` no longer reveals exact missing environment variable names or AI-key presence details.
- Added a baseline Content Security Policy and disabled the `X-Powered-By` header.
- Rate-limiter cleanup timer no longer keeps the Node.js event loop alive by itself.

## Still not magically solved

These still need a deeper product-aware pass before calling the app fully hardened:

- `typescript.ignoreBuildErrors` is still enabled in `apps/web/next.config.js`.
- Input validation is inconsistent across many API routes.
- Rate limiting is still in-memory, so it is not suitable for multi-instance scaling.
- The app still needs structured logging / external error reporting.
- CSRF protection is improved via same-origin checks, but a dedicated CSRF-token strategy would be stronger for sensitive browser flows.

## Recommended production deploy flow

### 1) Set environment variables

Use `.env.production` as the base and make sure at minimum these are set correctly:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENAI_API_KEY` (if AI features are required)
- `NEXT_PUBLIC_BASE_URL`
- `WEB_BASE_URL`
- `NEXT_PUBLIC_WEB_BASE_URL`
- `NEXT_PUBLIC_LINKUS_SDK_URL` (if Linkus is used)

### 2) Build locally

```bash
npx -y pnpm@9.0.0 install --frozen-lockfile
npx -y pnpm@9.0.0 check-types
npx -y pnpm@9.0.0 --filter web build
```

### 3) Docker production deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4) Smoke test after deploy

- Open `/api/health`
- Log in as an admin user
- Verify one company page loads
- Verify one protected API request works when logged in
- Verify one protected API request fails when logged out
- Verify uploads/log volume mounts are writable

## Packaging

If you want to ship this exact bundle elsewhere, zip the repository root excluding `node_modules`, `.next`, and other build outputs.
