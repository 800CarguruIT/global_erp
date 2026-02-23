# Mobile API

## Scope: Company

## Module Name: Inspections

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Inspections | GET | `/api/mobile/company/{companyId}/workshop/inspections` |
| Create Inspection | POST | `/api/mobile/company/{companyId}/workshop/inspections` |

## Workflow Sequence

`Mobile Auth -> Access Check -> List/Create Inspection -> Return Paginated Payload`

## 1. Name: Get Inspections

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| status | string | No | Yes | null | Status filter. |
| branchId | string (uuid) | No | Yes | null | Branch filter. |
| q | string | No | Yes | null | Search text. |
| dateFrom | string (ISO date) | No | Yes | null | Start date. |
| dateTo | string (ISO date) | No | Yes | null | End date. |
| limit | number | No | No | 20 | Page size. |
| offset | number | No | No | 0 | Offset. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True on success. |
| data.inspections | array | No | Inspections list. |
| data.meta.total | number | No | Total rows. |
| data.meta.hasMore | boolean | No | More pages. |

## 2. Name: Create Inspection

### Request Body Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| leadId | string (uuid) | No | Yes | null | Lead ID. |
| carId | string (uuid) | No | Yes | null | Car ID. |
| customerId | string (uuid) | No | Yes | null | Customer ID. |
| branchId | string (uuid) | No | Yes | null | Branch ID. |
| inspectorEmployeeId | string (uuid) | No | Yes | null | Inspector employee. |
| advisorEmployeeId | string (uuid) | No | Yes | null | Advisor employee. |
| status | string | No | No | `pending` | Initial status. |
| startAt | string | No | Yes | null | Start timestamp. |
| completeAt | string | No | Yes | null | Complete timestamp. |

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True. |
| data.inspection | object | No | Created inspection. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 403 | `{ "success": false, "error": "Forbidden" }` |
| 500 | `{ "success": false, "error": "Unexpected error" }` |
