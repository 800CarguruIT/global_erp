# Mobile API

## Scope: Company

## Module Name: Accounting

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Accounting Endpoints Availability | N/A | Not exposed in mobile routes yet |

## Workflow Sequence

`Mobile App -> Finance Views -> Use App API Accounting Endpoints`

## 1. Name: Accounting Endpoints Availability

### Description
Direct company accounting endpoints are not currently exposed under mobile API routes.

Use App API accounting endpoints:

- `GET /api/company/{companyId}/accounting/summary`
- `GET /api/company/{companyId}/accounting/pnl`
- `GET /api/company/{companyId}/accounting/balance-sheet`
- `GET /api/company/{companyId}/accounting/cashflow`

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | No mobile accounting contract exposed yet. |

### Success Response Schema

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| note | string | No | Guidance to use App API accounting endpoints. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 404 | `{ "success": false, "error": "Not found" }` (if client calls non-existing mobile accounting route) |
