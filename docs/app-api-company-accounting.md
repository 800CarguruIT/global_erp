# App API

## Scope: Company

## Module Name: Accounting

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Accounting Summary | GET | `/api/company/{companyId}/accounting/summary` |

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/accounting/summary` | `GET` |
| `/api/company/{companyId}/accounting/accounts` | `GET`, `POST` |
| `/api/company/{companyId}/accounting/journals` | `GET`, `POST` |
| `/api/company/{companyId}/accounting/journals/{id}` | `GET`, `PATCH`, `PUT` |
| `/api/company/{companyId}/accounting/trial-balance` | `GET` |
| `/api/company/{companyId}/accounting/pnl` | `GET` |
| `/api/company/{companyId}/accounting/balance-sheet` | `GET` |
| `/api/company/{companyId}/accounting/cashflow` | `GET` |
| `/api/company/{companyId}/accounting/account-statement` | `GET` |
| `/api/company/{companyId}/accounting/config` | `GET`, `PATCH` |
| `/api/company/{companyId}/accounting/ai-summary` | `GET` |
| `/api/company/{companyId}/accounting/chart-of-accounts/pdf` | `GET` |

## Workflow Sequence

`Operational Entries -> Journal Lines -> Summary Metrics -> Ledger Preview`

## 1. Name: Get Accounting Summary

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| Authorization | string | Yes | No | None | Requires `accounting.view` permission. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| metrics | array | No | Metrics summary. |
| metrics[].key | string | No | Metric key. |
| metrics[].value | number | No | Metric value. |
| metrics[].detail | string | Yes | Currency/detail. |
| entries | array | No | Latest ledger entries. |
| entries[].id | string (uuid) | No | Journal line ID. |
| entries[].date | string (ISO datetime) | No | Entry date. |
| entries[].debit | number | No | Debit. |
| entries[].credit | number | No | Credit. |
| entries[].balance | number | No | Running balance. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "companyId is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 200 | `{ "metrics": [], "entries": [] }` (safe fallback on internal errors) |

## 2. Name: Chart and Account APIs

### Endpoints
- `GET|POST /api/company/{companyId}/accounting/accounts`
- `GET /api/company/{companyId}/accounting/chart-of-accounts/pdf`

### Description
Read and create chart-of-accounts entries and export chart PDF.

### A) Accounts List / Create

#### Endpoints
- `GET /api/company/{companyId}/accounting/accounts`
- `POST /api/company/{companyId}/accounting/accounts`

#### Request Schema (POST)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| code | string | Yes | No | Account code. |
| name | string | Yes | No | Account name. |
| type | string | Yes | No | Account type (`asset`, `liability`, etc.). |
| parentId | string (uuid) | No | Yes | Parent account ID. |
| isActive | boolean | No | Yes | Account active flag. |

#### Request Example (POST)

```json
{
  "code": "110201",
  "name": "Workshop Parts Expense",
  "type": "expense",
  "isActive": true
}
```

#### Success Response Schema (200/201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Account ID. |
| data.code | string | No | Account code. |
| data.name | string | No | Account name. |
| data.type | string | No | Account type. |

### B) Chart of Accounts PDF

#### Endpoint
- `GET /api/company/{companyId}/accounting/chart-of-accounts/pdf`

#### Description
Return printable PDF for chart of accounts.

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid account payload" }` |
| 409 | `{ "error": "Account code already exists" }` |
| 500 | `{ "error": "Failed to process accounts request" }` |

## 3. Name: Journal APIs

### Endpoints
- `GET|POST /api/company/{companyId}/accounting/journals`
- `GET|PATCH|PUT /api/company/{companyId}/accounting/journals/{id}`

### Description
Create and maintain journal entries and journal state transitions.

### A) Journals List / Create

#### Endpoints
- `GET /api/company/{companyId}/accounting/journals`
- `POST /api/company/{companyId}/accounting/journals`

#### Request Body Schema (POST)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| journalDate | string (ISO datetime) | Yes | No | Journal date. |
| referenceNo | string | No | Yes | External reference. |
| description | string | No | Yes | Journal description. |
| lines | array | Yes | No | Journal line entries. |
| lines[].accountId | string (uuid) | Yes | No | Account ID. |
| lines[].debit | number | No | Yes | Debit amount. |
| lines[].credit | number | No | Yes | Credit amount. |
| lines[].memo | string | No | Yes | Line note. |

#### Request Example (POST)

```json
{
  "journalDate": "2026-02-24T00:00:00.000Z",
  "referenceNo": "JV-2026-0012",
  "description": "Inventory adjustment",
  "lines": [
    { "accountId": "f5015982-90d5-4d5a-a66f-2363ad6a57ef", "debit": 1200 },
    { "accountId": "f2731ff6-2be3-4f25-a4f0-a355e35f8e38", "credit": 1200 }
  ]
}
```

### B) Journal by ID (Get / Patch / Put)

#### Endpoint
- `GET|PATCH|PUT /api/company/{companyId}/accounting/journals/{id}`

#### Patch/Put Fields (typical)
- `description`
- `referenceNo`
- `lines`
- `status` (if supported by workflow)

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Journal ID. |
| data.journalDate | string (ISO datetime) | Yes | Journal date. |
| data.lines | array | Yes | Journal lines. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid journal payload" }` |
| 404 | `{ "error": "Journal not found" }` |
| 500 | `{ "error": "Failed to process journal request" }` |

## 4. Name: Reports APIs

### Endpoints
- `GET /api/company/{companyId}/accounting/trial-balance`
- `GET /api/company/{companyId}/accounting/pnl`
- `GET /api/company/{companyId}/accounting/balance-sheet`
- `GET /api/company/{companyId}/accounting/cashflow`
- `GET /api/company/{companyId}/accounting/account-statement`

### Description
Return financial statements and account statements by company scope.

### Request Schema (common)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| from (query) | string (ISO date/datetime) | No | Yes | Start period. |
| to (query) | string (ISO date/datetime) | No | Yes | End period. |
| branchId (query) | string (uuid) | No | Yes | Optional branch filter. |
| accountId (query, statement only) | string (uuid) | No | Yes | Account filter. |

### Report Response Shapes

| Endpoint | Response |
| --- | --- |
| `/trial-balance` | account totals debit/credit by trial-balance format |
| `/pnl` | revenue/expense sections with net profit/loss |
| `/balance-sheet` | assets/liabilities/equity structure |
| `/cashflow` | inflow/outflow by period |
| `/account-statement` | account transactions + running balance |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid report query parameters" }` |
| 500 | `{ "error": "Failed to load accounting report" }` |

## 5. Name: Config and Intelligence APIs

### Endpoints
- `GET|PATCH /api/company/{companyId}/accounting/config`
- `GET /api/company/{companyId}/accounting/ai-summary`

### Description
Manage accounting configuration and fetch AI-assisted summary insights.

### A) Accounting Config

#### Endpoints
- `GET /api/company/{companyId}/accounting/config`
- `PATCH /api/company/{companyId}/accounting/config`

#### Patch Body Schema (typical)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| fiscalYearStartMonth | number | No | Yes | Fiscal year start month (1-12). |
| defaultCurrency | string | No | Yes | Default currency code. |
| lockPeriodBefore | string (ISO date) | No | Yes | Lock transactions before date. |
| requireJournalApproval | boolean | No | Yes | Journal approval toggle. |

#### Request Example (PATCH)

```json
{
  "fiscalYearStartMonth": 1,
  "defaultCurrency": "AED",
  "requireJournalApproval": true
}
```

### B) AI Summary

#### Endpoint
- `GET /api/company/{companyId}/accounting/ai-summary`

#### Description
Returns generated insights, anomalies, and trend summaries over accounting data.

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid config payload" }` |
| 500 | `{ "error": "Failed to process accounting config/ai request" }` |
