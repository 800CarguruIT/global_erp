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

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/workshop/job-cards` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/job-cards/{jobCardId}` | `GET`, `PATCH` |
| `/api/company/{companyId}/workshop/job-cards/{jobCardId}/line-items/{lineItemId}` | `PATCH` |

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

## 3. Name: Get / Update Job Card

### Endpoints
- `GET /api/company/{companyId}/workshop/job-cards/{jobCardId}`
- `PATCH /api/company/{companyId}/workshop/job-cards/{jobCardId}`

### Description
Fetch one job card and update execution status/progress details.

### A) Get Job Card

#### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| jobCardId (path) | string (uuid) | Yes | No | Job card ID. |

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Job card ID. |
| data.status | string | No | Job card status. |
| data.estimateId | string (uuid) | Yes | Linked estimate ID. |
| data.leadId | string (uuid) | Yes | Linked lead ID. |
| data.assignedTechnicianId | string (uuid) | Yes | Assigned technician. |
| data.startedAt | string (ISO datetime) | Yes | Start timestamp. |
| data.completedAt | string (ISO datetime) | Yes | Completion timestamp. |
| data.updatedAt | string (ISO datetime) | Yes | Last update timestamp. |

### B) Update Job Card

#### Request Body Schema (PATCH)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| status | string | No | Yes | Updated status (e.g. Pending/In Progress/Completed). |
| assignedTechnicianId | string (uuid) | No | Yes | Technician assignment. |
| progressNote | string | No | Yes | Internal progress note. |
| startedAt | string (ISO datetime) | No | Yes | Explicit start timestamp. |
| completedAt | string (ISO datetime) | No | Yes | Explicit completion timestamp. |

#### Request Example

```json
{
  "status": "In Progress",
  "assignedTechnicianId": "4cfeab7e-aebf-4e76-b5f0-2c8e38e3268f",
  "progressNote": "Vehicle moved to bay and work started."
}
```

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Job card ID. |
| data.status | string | No | Updated status. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid job card update payload" }` |
| 404 | `{ "error": "Job card not found" }` |
| 500 | `{ "error": "Failed to update job card" }` |

## 4. Name: Update Job Card Line Item

### Endpoint
- Method: `PATCH`
- URL: `/api/company/{companyId}/workshop/job-cards/{jobCardId}/line-items/{lineItemId}`

### Description
Update job-card line item execution fields (quantity, status, notes).

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| jobCardId (path) | string (uuid) | Yes | No | Job card ID. |
| lineItemId (path) | string (uuid) | Yes | No | Job-card line item ID. |
| status | string | No | Yes | Updated line-item status. |
| quantity | number | No | Yes | Executed/consumed quantity. |
| notes | string | No | Yes | Technician/internal notes. |
| laborHours | number | No | Yes | Labor hours consumed (if tracked). |

### Request Example

```json
{
  "status": "completed",
  "quantity": 1,
  "notes": "Part replaced and torque verified.",
  "laborHours": 1.5
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Line item ID. |
| data.status | string | Yes | Updated status. |
| data.quantity | number | Yes | Updated quantity. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid line item update payload" }` |
| 404 | `{ "error": "Line item not found" }` |
| 500 | `{ "error": "Failed to update job card line item" }` |
