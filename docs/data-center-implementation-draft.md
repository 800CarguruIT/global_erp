# Data Center Implementation Draft

## Scope

This draft introduces backend foundation for a company-level customer data center used by sales and call center teams.

Implemented foundation:

- Customer ownership model: supervisor -> agent -> customer
- Assignment audit history
- KPI endpoint inputs: by date, segment, supervisor, agent
- Agent performance reporting endpoints
- CSV export endpoint
- Role-scoped visibility controls (admin/supervisor/agent)
- Initial company UI page
- Dropdown selectors endpoint for supervisors/agents
- Inline reassignment actions in assignments table
- Mobile Data Center endpoints

## New Database Tables

- `customer_assignments`
  - current owner mapping per customer
  - segment field: `chsc`, `non_chsc`, `insurance`, `warranty`, `unknown`
  - status field: `active`, `unassigned`, `reassigned`
- `customer_assignment_history`
  - immutable assignment change log
  - includes old/new supervisor and agent IDs

Migration file:

- `packages/ai-core/migrations/164_customer_data_center_assignments.sql`

## New AI Core Module

- `packages/ai-core/src/customer-data-center/types.ts`
- `packages/ai-core/src/customer-data-center/repository.ts`
- `packages/ai-core/src/customer-data-center/service.ts`

Exported from `@repo/ai-core` as:

- `CustomerDataCenter`
- `CustomerDataCenterTypes`

## New API Endpoints

All endpoints are company-scoped and require `x-user-id`.

1. `GET /api/company/[companyId]/data-center/assignments`
2. `POST /api/company/[companyId]/data-center/assignments`
3. `POST /api/company/[companyId]/data-center/assignments/bulk`
4. `GET /api/company/[companyId]/data-center/kpis`
5. `GET /api/company/[companyId]/data-center/reports/agents`
6. `GET /api/company/[companyId]/data-center/reports/agents/[agentId]`
7. `GET /api/company/[companyId]/data-center/reports/export`
8. `GET /api/company/[companyId]/data-center/users`

Mobile endpoints:

1. `GET /api/mobile/company/[companyId]/data-center/overview`
2. `GET /api/mobile/company/[companyId]/data-center/assignments`
3. `PATCH /api/mobile/company/[companyId]/data-center/assignments`

Supported filters:

- `from`, `to`
- `segment`
- `supervisorUserId`
- `agentUserId`
- plus list-specific pagination/search fields

## KPI Logic (Current)

- `assignedCustomers`: active assignments in filter scope
- `contactedCustomers`: distinct assigned customers with at least one scoped call in period
- `pendingCustomers`: assigned - contacted
- `totalCalls`: scoped call count
- `answeredCalls`: calls with status `completed`
- `failedCalls`: calls with status `failed`
- `answeredRate`: answered / total
- `avgCallDurationSeconds`: average completed call duration

## Next Implementation Steps

1. Replace user-id inputs with searchable supervisor/agent selectors.
2. Add inline reassignment actions in assignments table.
3. Add follow-up SLA model (`customer_followups`) for overdue KPI.
4. Add mobile Data Center endpoints and screen parity.
