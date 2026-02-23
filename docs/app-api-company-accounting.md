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
