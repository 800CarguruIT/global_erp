# Mobile API

## Scope: Company

## Module Name: Estimates

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Estimates | GET | `/api/mobile/company/{companyId}/workshop/estimates` |

## Workflow Sequence

`Mobile Auth -> Access Check -> Filter/Paginate Estimates -> Return`

## 1. Name: Get Estimates

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| status | string | No | Yes | null | Status filter. |
| q | string | No | Yes | null | Search text. |
| plate | string | No | Yes | null | Plate filter. |
| dateFrom | string (ISO date) | No | Yes | null | Start date. |
| dateTo | string (ISO date) | No | Yes | null | End date. |
| limit | number | No | No | 20 | Page size. |
| offset | number | No | No | 0 | Offset. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True. |
| data.estimates | array | No | Estimate list. |
| data.meta.total | number | No | Total rows. |
| data.meta.hasMore | boolean | No | More pages. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 403 | `{ "success": false, "error": "Forbidden" }` |
| 500 | `{ "success": false, "error": "Unexpected error" }` |
