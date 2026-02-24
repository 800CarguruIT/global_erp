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
