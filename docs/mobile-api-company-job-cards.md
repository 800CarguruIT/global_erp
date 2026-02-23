# Mobile API

## Scope: Company

## Module Name: Job Cards

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Job Cards | GET | `/api/mobile/company/{companyId}/workshop/job-cards` |

## Workflow Sequence

`Mobile Auth -> Access Check -> List/Filter Job Cards -> Return`

## 1. Name: Get Job Cards

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| estimateId | string (uuid) | No | Yes | null | Estimate filter. |
| all | boolean/string | No | No | false | Return all by estimate. |
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
| data.jobCards | array | Yes | List mode payload. |
| data.jobCard | object | Yes | Single mode payload. |
| data.meta.total | number | Yes | Total (list mode). |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 403 | `{ "success": false, "error": "Forbidden" }` |
| 500 | `{ "success": false, "error": "Unexpected error" }` |
