# App API

## Scope: Company

## Module Name: Job Cards

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Job Cards | GET | `/api/company/{companyId}/workshop/job-cards` |
| Create Job Card | POST | `/api/company/{companyId}/workshop/job-cards` |

## Workflow Sequence

`Estimate -> Create Job Card -> Attach Approved Line Items -> Track Status`

## 1. Name: Get Job Cards

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| estimateId (query) | string (uuid) | No | Yes | null | Estimate filter. |
| all (query) | boolean/string | No | No | false | Return all cards for estimate. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array/object/null | Yes | Response varies by query mode. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 500 | `{ "error": "Failed to load job cards" }` |
| 503 | `{ "error": "Database unavailable" }` |

## 2. Name: Create Job Card

### Request Body Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| estimateId | string (uuid) | Yes | No | None | Source estimate ID. |
| isAdd | boolean/number/string | No | No | false | Add mode switch. |
| lineItemIds | array<string> | No | No | [] | Approved line item IDs. |

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Job card ID. |
| data.status | string | No | Initial status (`Pending`). |
| data.estimate_id | string (uuid) | No | Estimate ID. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "estimateId is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "Estimate not found" }` |
| 409 | `{ "error": "Job card already active" }` |
| 500 | `{ "error": "Failed to create job card" }` |
