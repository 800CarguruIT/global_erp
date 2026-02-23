# App API

## Scope: Company

## Module Name: Estimates

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| List Estimates | GET | `/api/company/{companyId}/workshop/estimates` |
| Create Estimate | POST | `/api/company/{companyId}/workshop/estimates` |

## Workflow Sequence

`Approved Inspection -> Create Estimate -> Calculate Totals -> Return Estimate`

## 1. Name: List Estimates

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| status (query) | string | No | Yes | null | Estimate status filter. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Estimate list. |
| data[].id | string (uuid) | No | Estimate ID. |
| data[].status | string | No | Estimate status. |
| data[].inspectionId | string (uuid) | Yes | Inspection ID. |

## 2. Name: Create Estimate

### Request Body Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| inspectionId | string (uuid) | Yes | No | None | Source inspection ID. |

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | object | No | Created estimate result. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `"inspectionId required"` |
| 500 | `{ "error": "Failed to create estimate" }` |
