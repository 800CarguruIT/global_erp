## Technical Document

### Architecture overview
- **Databases**: PostgreSQL schemas mirror each module (e.g., `workshop`, `inventory`, `accounting`). Use migrations under `packages/ai-core/migrations` to track schema evolution.
- **Data flow**: APIs, background jobs, and triggers share a canonical domain model. Write to dedicated tables (`inventory_movements`, `workshop_inspections`, etc.) and rely on triggers (e.g., `apply_inventory_movement`) for aggregates.

### Key diagrams and references
1. **DB relationships**: `companies` ➜ `branches` ➜ `workshop_job_cards`/`fleet_vehicles`, `parts_catalog` ↔ `inventory_stock`. Refer to `backup-before-migrations.sql` and `packages/ai-core/migrations/*.sql` for full constraint scripts.
2. **API surface**: `/api/company/[companyId]/workshop/*` for repair workflow, `/api/company/[companyId]/vendors/*` for procurement, `/api/global/*` for multicompany dashboards, `/api/mobile/company/[companyId]/*` for the mobile experience.
3. **Documentation consumption**: global pages under `/global/docs` read Markdown files from the repo-wide `docs/` directory, making updates visible instantly.

### Engineering best practices
- Keep repository-level helpers (e.g., `packages/ai-core/src/workshop/*/repository.ts`) thin—business logic should live inside services with explicit transaction boundaries.
- Always record API contracts in `apps/web/app/api/*` routes and mirror them with client hooks or UI forms; include response codes and required headers when you update a contract.
- Document operation-runbooks (backup cadence, migration strategy, alerting) alongside this technical knowledge base so on-call teams can respond without guesswork.
