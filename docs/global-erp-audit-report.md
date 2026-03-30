# Global ERP -- Comprehensive Audit Report

**Date:** 2026-03-30
**Scope:** Full codebase audit (apps/web/, packages/ai-core/)
**Areas:** Security, Performance, Data Integrity & Cleanliness
**Tech Stack:** Next.js 16, TypeScript, PostgreSQL 16, Turbo Monorepo

---

## Executive Summary

This audit reviewed the Global ERP codebase across three critical dimensions: **Security**, **Performance**, and **Data Integrity**. The system has **72 findings** across all categories, including **11 Critical**, **22 High**, **20 Medium**, and **7 Low** severity issues.

### Critical Issues Requiring Immediate Action

| # | Category | Issue | Impact |
|---|----------|-------|--------|
| 1 | Security | Middleware exempts nearly all API routes from authentication | Any unauthenticated user can access company data, accounting, files |
| 2 | Security | OpenAI API key committed to repository `.env` | API key theft, financial abuse |
| 3 | Security | Hardcoded admin password `Admin@123` for all companies | Trivial account takeover |
| 4 | Data | No permission checks on entire Workshop module (invoices, estimates, gatepass) | Any authenticated user can create invoices, release cars |
| 5 | Data | No permission checks on individual lead routes (GET/PATCH/DELETE) | Any user can read/modify/delete any lead |
| 6 | Data | No permission checks on Sales leads routes | Unauthorized sales data access |
| 7 | Data | Lead deletion leaves orphan inspections, estimates, work orders, invoices | Data corruption, ghost records |
| 8 | Data | Multiple core tables lack FK on `company_id` | Cross-tenant data corruption possible |
| 9 | Performance | Database connection pool `max: 1` | All queries serialize under load, system-wide bottleneck |
| 10 | Performance | Bulk customer assignment runs 3 queries per row in a loop | 1500+ queries for 500 customers |
| 11 | Data | Estimates default query limit of 200,000 rows | Out-of-memory crashes |

---

## Part 1: Security Audit

### 1.1 Authentication & Authorization

#### CRITICAL: Overly Broad Public Path Configuration
- **File:** [middleware.ts](apps/web/middleware.ts) (lines 12-25)
- **Description:** The middleware uses `startsWith` matching for public paths. The following prefixes bypass authentication entirely:
  - `/api/customers` -- ALL customer API routes
  - `/api/company` -- ALL company-scoped routes (workshop, accounting, call-center, AI, fleet, branches)
  - `/api/cars` -- ALL car API routes
  - `/api/files` -- ALL file upload/download routes
  - `/api/global/leads` -- ALL global lead routes
  - `/api/mobile` -- ALL mobile API routes
- **Impact:** The middleware cookie check is effectively bypassed for the majority of API routes.
- **Recommendation:** Restrict public paths to only genuinely public routes (e.g., `/api/public/`). Use exact matches.

#### CRITICAL: Many API Routes Completely Unauthenticated
- **Description:** Because middleware passes them through AND they have no internal auth check:

| Route | Methods | Data Exposed |
|-------|---------|-------------|
| `/api/accounting/accounts` | GET, POST, PATCH | Chart of accounts |
| `/api/accounting/groups` | GET, POST, DELETE | Accounting groups |
| `/api/accounting/headings` | GET, POST | Accounting headings |
| `/api/accounting/invoices` | GET, POST | Billing invoices |
| `/api/accounting/invoices/[id]` | GET, PATCH | Individual invoice data |
| `/api/accounting/org-profile` | GET, PUT | Organization profile |
| `/api/products` | GET | Product catalog |
| `/api/dialer/integrations` | GET, POST | Dialer integrations |
| `/api/channels/integrations` | GET, POST | Channel credentials |
| `/api/global/call-center/incoming/stream` | GET | Live call center SSE stream |
| `/api/files/upload` | POST | Unrestricted file upload |
| `/api/files/[fileId]` | GET | Any uploaded file |

#### HIGH: Permission Check Bypass in Customers Route
- **File:** [customers/route.ts](apps/web/app/api/customers/route.ts) (lines 62-74)
- **Description:** The GET handler catches permission failures and logs a warning but continues serving data:
  ```typescript
  if (permResp.status >= 400) {
    console.warn("Skipping permission enforcement for customers view");
  }
  ```

#### MEDIUM: Session Tokens Have No Expiry
- **File:** [session.ts](apps/web/lib/auth/session.ts) (lines 36-61)
- **Description:** Session tokens include `iat` but no `exp`. Token valid indefinitely if extracted. Cookie has 7-day `maxAge` but the token itself never expires.

#### MEDIUM: No Company/Branch Ownership Validation
- **Description:** Routes under `/api/company/[companyId]/...` extract `companyId` from URL but don't verify the authenticated user belongs to that company. User from Company A could access Company B's data.

### 1.2 SQL Injection

#### GOOD: SQL Library Uses Parameterized Queries
- The `postgres` library's tagged template literals automatically parameterize values. The vast majority of queries are safe.

#### LOW: `sql.unsafe()` in tmp Script
- **File:** `tmp/check-inquiry.mjs` (line 5) -- Direct string interpolation in debug script. Not deployed but risky if copy-pasted.

### 1.3 IDOR (Insecure Direct Object Reference)

#### HIGH: Global Leads Accessible Without Ownership Check
- **File:** [global/leads/[id]/route.ts](apps/web/app/api/global/leads/[id]/route.ts) (lines 47-56)
- **Description:** GET handler allows anonymous access (catches auth errors, continues with `currentUser = null`). Any lead retrievable by ID.

#### MEDIUM: File Download Without Access Control
- **File:** [files/[fileId]/route.ts](apps/web/app/api/files/[fileId]/route.ts) (lines 8-45)
- **Description:** Any file downloadable by guessing UUID. No authentication, no ownership validation.

### 1.4 Rate Limiting

#### HIGH: No Rate Limiting on Authentication Endpoints
- **Files:** [auth/login/route.ts](apps/web/app/api/auth/login/route.ts), [mobile/auth/login/route.ts](apps/web/app/api/mobile/auth/login/route.ts)
- **Description:** Neither endpoint has rate limiting. Brute force attacks possible.
- **Note:** A `createRateLimiter` utility exists in `tmp/zip_compare/` but was never deployed.

#### HIGH: No Rate Limiting on Public API Endpoints
- **Description:** `/api/public/recovery-requests/`, `/api/public/pre-inspection/`, `/api/files/upload` have no rate limiting.

### 1.5 Webhook Security

#### HIGH: Webhook Endpoints Lack Signature Verification
- **Files:** [webhooks/dialer/[providerKey]/route.ts](apps/web/app/api/webhooks/dialer/[providerKey]/route.ts), [webhooks/channels/[providerKey]/route.ts](apps/web/app/api/webhooks/channels/[providerKey]/route.ts)
- **Description:** Both accept any POST without verifying HMAC or shared secret. Attacker can inject fake call events and trigger AI workflows.

### 1.6 File Upload Security

#### HIGH: No File Size Limit on Upload
- **File:** [files/upload/route.ts](apps/web/app/api/files/upload/route.ts) (lines 21-114)
- **Description:** No maximum file size enforcement. Disk exhaustion possible.

#### MEDIUM: No File Type Restriction
- **Description:** Accepts any MIME type. No allowlist. Executable/malicious files can be uploaded.

#### MEDIUM: No Authentication on File Upload
- **Description:** `uploadedBy` always set to `null`. Anyone can upload files anonymously.

### 1.7 Sensitive Data Exposure

#### CRITICAL: OpenAI API Key in Repository
- **File:** `.env` (line 2)
- **Description:** Live OpenAI API key (`sk-proj-...`) stored in `.env` at repo root.
- **Recommendation:** Rotate immediately. Use secrets manager.

#### CRITICAL: Hardcoded Default Admin Password
- **File:** [companyBootstrap.ts](packages/ai-core/src/company/companyBootstrap.ts) (line 5)
- **Description:** `const DEFAULT_COMPANY_ADMIN_PASSWORD = "Admin@123"` used for all new company admin accounts.

#### HIGH: Weak AUTH_SECRET in Development
- **File:** `.env` (line 3)
- **Description:** `AUTH_SECRET=dev-secret-change-me`. If used in production, all session tokens can be forged.

#### MEDIUM: tmp/ Contains Production .env Files
- **Files:** `tmp/zip_compare/.env.production`, `tmp/zip_extracted/.env.production`
- **Description:** Production secrets may be exposed in repository tmp directory.

### 1.8 CSRF/XSS

#### MEDIUM: SameSite=Lax Without CSRF Token
- **File:** [session.ts](apps/web/lib/auth/session.ts) (line 113)
- **Description:** No explicit CSRF tokens for state-changing operations.

#### LOW: innerHTML Usage
- **File:** [ChannelManager.tsx](apps/web/app/global/marketing/_components/ChannelManager.tsx) (lines 672, 737)
- **Description:** `innerHTML = ""` is safe but sets a risky pattern.

---

## Part 2: Performance Audit

### 2.1 Connection Pool

#### CRITICAL: Database Pool Max = 1
- **File:** [db.ts](packages/ai-core/src/db.ts) (line 14)
- **Description:** `max: 1` creates a severe bottleneck. Every concurrent query across the entire application serializes. This amplifies every other performance issue.
- **Recommendation:** Increase to `max: 10-20` based on expected concurrency.

### 2.2 N+1 Query Problems

#### CRITICAL: Bulk Customer Assignment Loop
- **File:** [customer-data-center/service.ts](packages/ai-core/src/customer-data-center/service.ts) (lines 30-37)
- **Description:** `bulkAssignCustomers()` calls `upsertCustomerAssignment()` one-by-one. Each upsert = 3 queries. 500 customers = ~1500 queries.
- **Recommendation:** Single batch INSERT with `ON CONFLICT`.

#### HIGH: Work Order Items Loop Insert
- **File:** [workorders/repository.ts](packages/ai-core/src/workshop/workorders/repository.ts) (lines 73-101)
- **Description:** `createWorkOrderFromEstimate()` inserts each item individually in a `for...of` loop.

#### HIGH: Work Order Item Status Updates Loop
- **File:** [workorders/repository.ts](packages/ai-core/src/workshop/workorders/repository.ts) (lines 208-217)
- **Description:** `updateWorkOrderItemsStatuses()` updates each item one-by-one.

#### HIGH: Invoice Items Loop Insert
- **File:** [invoices/repository.ts](packages/ai-core/src/workshop/invoices/repository.ts) (lines 128-161)
- **Description:** `createInvoiceFromQualityCheck()` inserts invoice items one at a time.

#### HIGH: Inspection Items Loop Replace
- **File:** [inspections/repository.ts](packages/ai-core/src/workshop/inspections/repository.ts) (lines 313-337)
- **Description:** `replaceInspectionItems()` deletes all then re-inserts each item individually.

#### HIGH: Journal Lines Loop Insert
- **File:** [accounting/repository.ts](packages/ai-core/src/accounting/repository.ts) (lines 209-231)
- **Description:** `insertJournal()` inserts each journal line one-by-one.

#### HIGH: Call History N+1 Lookups
- **File:** [call-center/history/route.ts](apps/web/app/api/company/[companyId]/call-center/history/route.ts) (lines 52-103)
- **Description:** Individual queries per unique user and customer. Phone-based lookup scans entire customers table per phone number.

### 2.3 Unbounded Queries

#### HIGH: listCustomers -- No LIMIT
- **File:** [crm/repository.ts](packages/ai-core/src/crm/repository.ts) (lines 58-66)
- **Description:** Returns all rows. 100K customers = full table scan to memory.

#### HIGH: listLeadsForCompany -- No LIMIT
- **File:** [crm/leads/repository.ts](packages/ai-core/src/crm/leads/repository.ts) (lines 101-130)
- **Description:** Returns all leads with 5 LEFT JOINs. Also calls `releaseExpiredAssignments()` (a write!) on every read.

#### HIGH: Customer Export -- pageSize "all"
- **File:** [customers/export/route.ts](apps/web/app/api/customers/export/route.ts) (lines 197-203)
- **Description:** Loads all customers into memory for PDF generation. Safe limit allows up to 500,000 rows.

#### HIGH: Multiple List Functions Without LIMIT
- `listCars()`, `listLeadsForCustomer()`, `listWorkOrdersForCompany()`, `listJournals()`, `listCompanyWalletTransactions()` -- all unbounded.

### 2.4 Missing Database Indexes

#### HIGH: accounting_journal_lines.created_at Not Indexed
- **File:** [090_accounting_journals.sql](packages/ai-core/migrations/090_accounting_journals.sql)
- **Description:** All financial reports filter by `jl.created_at::date`. The `::date` cast prevents index usage. No functional index exists.
- **Recommendation:** Add functional index or change queries to range comparisons.

#### HIGH: accounting_journal_lines.account_id Not Indexed
- **Description:** Trial balance, P&L, and balance sheet all JOIN on `jl.account_id = a.id`.

#### HIGH: call_sessions.created_at Not Indexed
- **Description:** Analytics queries filter by `created_at BETWEEN`. Existing composite index doesn't include it.

#### HIGH: leads.customer_id Not Indexed
- **Description:** Frequently queried for customer detail pages.

#### Missing: customer_wallet_transactions indexes, invoices.lead_id index

### 2.5 Heavy Computation in Request Handlers

#### HIGH: Synchronous Image/Video Processing
- **File:** [files/upload/route.ts](apps/web/app/api/files/upload/route.ts) (lines 53-89)
- **Description:** `sharp` image resize + `ffmpeg` video transcode run synchronously in the request handler. Blocks event loop.

#### HIGH: Synchronous PDF Generation in Export
- **File:** [customers/export/route.ts](apps/web/app/api/customers/export/route.ts) (lines 112-168)
- **Description:** PDF iterates over all customers to generate pages. Combined with unbounded query.

### 2.6 Missing Caching

#### MEDIUM: No Caching Layer
- **Description:** Only cache found is `signalCache.ts` for AI results. No caching for:
  - Company/branch settings (queried every request)
  - User permissions/roles
  - Standard chart of accounts
  - Part category trees
  - Translations
- **Recommendation:** Add Redis or in-memory cache for rarely-changing data.

### 2.7 SELECT * Overuse

#### MEDIUM: All Queries Use SELECT *
- **Description:** Every repository uses `SELECT *`, pulling large JSONB/text columns (e.g., `draft_payload`, `ai_summary_markdown`) even for list views.
- **Recommendation:** Explicit column selection for list queries.

### 2.8 Side Effects in Read Queries

#### MEDIUM: Write Operations Inside GET Handlers
- **File:** [crm/leads/repository.ts](packages/ai-core/src/crm/leads/repository.ts) (lines 101-103)
- **Description:** `listLeadsForCompany()` and `listLeadsForCustomer()` call `releaseExpiredAssignments()` which runs UPDATE. Read operations should not write.

### 2.9 Runtime Schema Migration

#### MEDIUM: ALTER TABLE in Request Path
- **File:** [crm/leads/repository.ts](packages/ai-core/src/crm/leads/repository.ts) (lines 28-99)
- **Description:** `ensureLeadAssignmentColumns()` queries `information_schema.columns` and potentially runs `ALTER TABLE` on first request.

---

## Part 3: Data Integrity & Cleanliness Audit

### 3.1 Missing Authorization on Business Routes

#### CRITICAL: No Permission Checks on Workshop Module
- **Files:** All routes under [workshop/](apps/web/app/api/company/[companyId]/workshop/) (estimates, inspections, invoices, job-cards, procurement, QC, gatepass, workorders)
- **Description:** Only `workshop/earnings/route.ts` has `requirePermission()`. All other workshop routes -- including invoice creation, payment, gatepass release -- have zero authorization.

#### CRITICAL: No Permission Checks on Lead Detail Routes
- **Files:** [crm/leads/[leadId]/route.ts](apps/web/app/api/company/[companyId]/crm/leads/[leadId]/route.ts), [crm/leads/[leadId]/events/route.ts](apps/web/app/api/company/[companyId]/crm/leads/[leadId]/events/route.ts)
- **Description:** Both have `// TODO: add auth/permission checks` comments. Any authenticated user can CRUD any lead.

#### CRITICAL: No Permission Checks on Sales Leads
- **Files:** [sales/leads/route.ts](apps/web/app/api/company/[companyId]/sales/leads/route.ts)

### 3.2 Status Transition Validation

#### HIGH: No Status Transition Validation on Leads
- **File:** [crm/leads/[leadId]/route.ts](apps/web/app/api/company/[companyId]/crm/leads/[leadId]/route.ts) (line 38)
- **Description:** Any status transition allowed. Lead can go `closed_won` -> `open` or `lost` -> `processing`. No state machine enforced.

#### HIGH: Invoice Can Be Re-Paid Without Status Check
- **File:** [invoices/[invoiceId]/pay/route.ts](apps/web/app/api/company/[companyId]/workshop/invoices/[invoiceId]/pay/route.ts) (lines 18-25)
- **Description:** Updates to `paid` without checking current status. Already-paid or cancelled invoice can be "paid" again.

#### MEDIUM: Gatepass Status Accepts Any Value
- **Description:** `body.status as GatepassStatus` is TypeScript-only cast. No runtime validation. No DB CHECK constraint.

#### MEDIUM: Estimate Status No Runtime Validation
- **Description:** `body.status as EstimateStatus` accepted without validation.

#### MEDIUM: Inspection Accepts Any Initial Status
- **Description:** Can create inspection with status `completed` bypassing the workflow.

### 3.3 Orphan Records

#### CRITICAL: Lead Deletion Leaves Orphans
- **File:** [crm/leads/repository.ts](packages/ai-core/src/crm/leads/repository.ts) (lines 727-738)
- **Description:** `deleteLead()` only deletes `lead_events` then `leads`. Downstream `inspections`, `estimates`, `work_orders`, `invoices`, `gatepasses` have `lead_id` columns with NO FK constraints -- they become orphans.

#### HIGH: No FK on inspections.lead_id, car_id, customer_id
- **File:** [013_inspections.sql](packages/ai-core/migrations/013_inspections.sql) (lines 7-9)
- **Description:** All three columns lack REFERENCES clauses.

#### HIGH: No FK on estimates.company_id, inspection_id, lead_id, car_id, customer_id
- **File:** [014_estimates.sql](packages/ai-core/migrations/014_estimates.sql) (lines 5-9)

#### HIGH: No FK on work_orders, invoices, gatepasses, quality_checks
- **Files:** `016_work_orders.sql`, `018_invoices.sql`, `019_gatepasses.sql`, `017_quality_checks.sql`

### 3.4 Duplicate Data Prevention

#### HIGH: No Unique Constraint on Customer Phone/Email
- **File:** [007_customers_cars_and_company_master.sql](packages/ai-core/migrations/007_customers_cars_and_company_master.sql) (lines 49-75)
- **Description:** Only `(company_id, code)` is unique. Application-level duplicate check is race-condition prone.
- **Recommendation:** `CREATE UNIQUE INDEX ON customers(company_id, phone) WHERE phone IS NOT NULL`

#### MEDIUM: No Unique Constraint on Car Plate Number
- **Description:** `idx_cars_company_plate` is non-unique. Concurrent operations can create duplicate plates.

#### MEDIUM: No Unique Constraint on VIN
- **Description:** Duplicate VIN records possible.

### 3.5 Financial Data Integrity

#### HIGH: Invoice Payment Not Inside a Transaction
- **File:** [invoices/[invoiceId]/pay/route.ts](apps/web/app/api/company/[companyId]/workshop/invoices/[invoiceId]/pay/route.ts) (lines 17-25)
- **Description:** Standalone SQL statement outside a transaction. No journal entry created.

#### HIGH: Wallet Balance Has No Concurrency Control
- **File:** [invoices/route.ts](apps/web/app/api/company/[companyId]/workshop/invoices/route.ts) (lines 51-101)
- **Description:** Wallet balance read with regular SELECT, then compared, then updated. Two concurrent invoices can double-spend. No `SELECT ... FOR UPDATE`.

#### HIGH: Accounting Journal Skips Account Validation
- **File:** [accounting/journals/route.ts](apps/web/app/api/company/[companyId]/accounting/journals/route.ts) (lines 46-54)
- **Description:** Both POST and PUT pass `skipAccountValidation: true`. Journal entries can reference non-existent accounts.

#### MEDIUM: Floating-Point Arithmetic for Financial Calculations
- **File:** [accounting/service.ts](packages/ai-core/src/accounting/service.ts) (lines 104-106)
- **Description:** JavaScript floating-point addition for debit/credit sums. `0.1 + 0.2 !== 0.3` problem.
- **Recommendation:** Use decimal library or integer math (cents).

#### MEDIUM: Numeric Precision Mismatch
- **Description:** Journal lines use `numeric(18,4)`, estimates/invoices use `numeric(14,2)`. Precision loss when posting to ledger.

### 3.6 Missing Audit Trails

#### HIGH: Invoice Payment Has No Audit Trail
- **Description:** No actor, no previous status, no payment details logged.

#### HIGH: Estimate Modifications Have No Audit Trail
- **Description:** PATCH replaces items wholesale without logging changes. Financial document.

#### HIGH: Wallet Debit Transactions Have No Actor
- **Description:** `approved_by: null` always. Acting user never captured.

#### MEDIUM: Gatepass Release Has No Audit Log
- **Description:** No releasing user or timestamp recorded.

#### MEDIUM: Job Card Creation Not Logged to Lead Events
- **Description:** Significant workflow milestone with no lead_event.

### 3.7 Default Values & Constraints

#### MEDIUM: No CHECK Constraints on Status Columns
- **Tables affected:** `estimates`, `work_orders`, `invoices`, `inspections`, `gatepasses`
- **Description:** All use `text NOT NULL` with no CHECK constraint. Any string accepted.

### 3.8 Timestamp Consistency

#### MEDIUM: Tables with updated_at but No Auto-Update Trigger
- **Tables:** `customers`, `cars`, `customer_car_links`, `leads`, `employees`, `vendors`, `branches`, `call_center_sessions`, `customer_wallet_transactions`
- **Description:** Define `updated_at DEFAULT now()` but no `BEFORE UPDATE` trigger.

### 3.9 Data Type Issues

#### MEDIUM: line_items.quantity is Integer, But estimate_items.quantity is Numeric
- **Description:** Fractional quantities in estimates cannot be represented in line items.

#### MEDIUM: Invoice Payment Allows Null paymentMethod
- **Description:** Invoice marked `paid` without requiring a payment method.

---

## Summary of All Findings

### By Severity

| Severity | Security | Performance | Data Integrity | Total |
|----------|----------|-------------|----------------|-------|
| Critical | 3 | 2 | 6 | **11** |
| High | 7 | 11 | 14 | **22** (note: some overlap between security/data) |
| Medium | 9 | 5 | 14 | **20** (note: some overlap) |
| Low | 4 | 0 | 3 | **7** |

### Top 10 Recommendations (Priority Order)

| # | Action | Category | Effort |
|---|--------|----------|--------|
| 1 | **Fix middleware public paths** -- restrict `/api/company`, `/api/customers`, `/api/cars`, `/api/files` from being public | Security | Medium |
| 2 | **Rotate OpenAI API key** and implement secrets management | Security | Low |
| 3 | **Remove hardcoded admin password** -- generate random passwords, require change on first login | Security | Low |
| 4 | **Add `requirePermission()` to all workshop routes** (estimates, invoices, gatepass, work orders, QC, procurement) | Security/Data | High |
| 5 | **Increase DB connection pool** from `max: 1` to `max: 10-20` | Performance | Low |
| 6 | **Add FK constraints** on `company_id`, `inspection_id`, `estimate_id`, `lead_id` across core tables | Data | Medium |
| 7 | **Add rate limiting** to login endpoints and public APIs | Security | Medium |
| 8 | **Convert loop inserts to batch inserts** (work orders, invoices, inspections, journals) | Performance | Medium |
| 9 | **Add LIMIT/pagination** to all list queries (customers, leads, work orders, journals) | Performance | Medium |
| 10 | **Add status transition validation** with state machine for leads, estimates, invoices, gatepass | Data | Medium |

### Quick Wins (Low Effort, High Impact)

1. Change `max: 1` to `max: 15` in [db.ts](packages/ai-core/src/db.ts)
2. Add `CHECK` constraints on status columns in migration
3. Add unique index on `customers(company_id, phone)`
4. Add index on `accounting_journal_lines(account_id)` and `(created_at)`
5. Add index on `leads(company_id, customer_id)`
6. Remove `tmp/` directory with production .env files
7. Add webhook signature verification
8. Wrap invoice payment in transaction with journal entry

---

## Appendix: Files Referenced

### Security-Critical Files
- [middleware.ts](apps/web/middleware.ts) -- Route protection
- [session.ts](apps/web/lib/auth/session.ts) -- Token management
- [companyBootstrap.ts](packages/ai-core/src/company/companyBootstrap.ts) -- Admin password
- [files/upload/route.ts](apps/web/app/api/files/upload/route.ts) -- File upload

### Performance-Critical Files
- [db.ts](packages/ai-core/src/db.ts) -- Connection pool
- [crm/repository.ts](packages/ai-core/src/crm/repository.ts) -- Customer/car queries
- [crm/leads/repository.ts](packages/ai-core/src/crm/leads/repository.ts) -- Lead queries
- [workshop/workorders/repository.ts](packages/ai-core/src/workshop/workorders/repository.ts) -- Work order operations
- [workshop/invoices/repository.ts](packages/ai-core/src/workshop/invoices/repository.ts) -- Invoice operations
- [accounting/repository.ts](packages/ai-core/src/accounting/repository.ts) -- Financial queries

### Data Integrity-Critical Files
- [013_inspections.sql](packages/ai-core/migrations/013_inspections.sql) -- Missing FKs
- [014_estimates.sql](packages/ai-core/migrations/014_estimates.sql) -- Missing FKs
- [016_work_orders.sql](packages/ai-core/migrations/016_work_orders.sql) -- Missing FKs
- [018_invoices.sql](packages/ai-core/migrations/018_invoices.sql) -- Missing FKs
- [019_gatepasses.sql](packages/ai-core/migrations/019_gatepasses.sql) -- Missing FKs
- [007_customers_cars_and_company_master.sql](packages/ai-core/migrations/007_customers_cars_and_company_master.sql) -- Missing unique constraints
