# App API

## Scope: Company

## Module Name: Inspections

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| List Inspections | GET | `/api/company/{companyId}/workshop/inspections` |
| Create Inspection | POST | `/api/company/{companyId}/workshop/inspections` |

## Workflow Sequence

`Lead/Car -> Create Inspection -> Capture Findings -> Return Inspection`

## 1. Name: List Inspections

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| status (query) | string | No | Yes | null | Inspection status filter. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Inspection list. |
| data[].id | string (uuid) | No | Inspection ID. |
| data[].status | string | No | Status. |
| data[].car | object | Yes | Car summary. |
| data[].customer | object | Yes | Customer summary. |
| data[].branch | object | Yes | Branch summary. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 500 | `{ "error": "Failed to load inspections" }` |

## 2. Name: Create Inspection

### Request Body Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| leadId | string (uuid) | No | Yes | null | Lead ID. |
| carId | string (uuid) | No | Yes | null | Car ID. |
| customerId | string (uuid) | No | Yes | null | Customer ID. |
| inspectorEmployeeId | string (uuid) | No | Yes | null | Inspector employee. |
| advisorEmployeeId | string (uuid) | No | Yes | null | Advisor employee. |
| status | string | No | No | `pending` | Initial status. |
| customerRemark | string | No | Yes | null | Customer remark. |
| agentRemark | string | No | Yes | null | Internal remark. |
| draftPayload | object | No | Yes | null | Draft payload. |

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Inspection ID. |
| data.status | string | No | Status. |
| data.companyId | string (uuid) | No | Company ID. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid payload" }` |
| 500 | `{ "error": "Failed to create inspection" }` |
