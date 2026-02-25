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

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/workshop/inspections` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inspections/{inspectionId}` | `GET`, `PATCH` |
| `/api/company/{companyId}/workshop/inspections/{inspectionId}/line-items` | `GET`, `POST`, `PATCH` |
| `/api/company/{companyId}/workshop/inspections/{inspectionId}/line-items/{lineItemId}` | `PATCH`, `DELETE` |

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

## 3. Name: Get / Update Inspection

### Endpoints
- `GET /api/company/{companyId}/workshop/inspections/{inspectionId}`
- `PATCH /api/company/{companyId}/workshop/inspections/{inspectionId}`

### Description
Fetch one inspection and update inspection state/details.

### A) Get Inspection

#### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| inspectionId (path) | string (uuid) | Yes | No | Inspection ID. |

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Inspection ID. |
| data.status | string | No | Inspection status. |
| data.leadId | string (uuid) | Yes | Linked lead ID. |
| data.carId | string (uuid) | Yes | Linked car ID. |
| data.customerId | string (uuid) | Yes | Linked customer ID. |
| data.inspectorEmployeeId | string (uuid) | Yes | Assigned inspector. |
| data.advisorEmployeeId | string (uuid) | Yes | Assigned advisor. |
| data.createdAt | string (ISO datetime) | Yes | Creation timestamp. |
| data.updatedAt | string (ISO datetime) | Yes | Last update timestamp. |

### B) Update Inspection

#### Request Body Schema (PATCH)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| status | string | No | Yes | Updated inspection status. |
| inspectorEmployeeId | string (uuid) | No | Yes | Updated inspector assignment. |
| advisorEmployeeId | string (uuid) | No | Yes | Updated advisor assignment. |
| customerRemark | string | No | Yes | Customer-side remark. |
| agentRemark | string | No | Yes | Internal remark. |
| draftPayload | object | No | Yes | Draft structure/details. |

#### Request Example

```json
{
  "status": "completed",
  "advisorEmployeeId": "fa0ea235-f89d-40f6-8fe3-9d8cfd1cd2ec",
  "agentRemark": "Final review completed by advisor."
}
```

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Inspection ID. |
| data.status | string | No | Updated status. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid inspection update payload" }` |
| 404 | `{ "error": "Inspection not found" }` |
| 500 | `{ "error": "Failed to update inspection" }` |

## 4. Name: Inspection Line Items

### Endpoints
- `GET /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items`
- `POST /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items`
- `PATCH /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items`
- `PATCH /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items/{lineItemId}`
- `DELETE /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items/{lineItemId}`

### Description
Create/update/delete inspection findings and recommendations at line-item level.

### A) Get Line Items

#### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| inspectionId (path) | string (uuid) | Yes | No | Inspection ID. |

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Line item list. |
| data[].id | string (uuid) | No | Line item ID. |
| data[].title | string | Yes | Item title/name. |
| data[].status | string | Yes | Item status. |
| data[].notes | string | Yes | Item notes. |

### B) Create Line Item

#### Request Body Schema (POST)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| title | string | Yes | No | Item title/name. |
| category | string | No | Yes | Item category. |
| severity | string | No | Yes | Severity level. |
| status | string | No | Yes | Initial status. |
| notes | string | No | Yes | Notes/findings. |
| recommendedAction | string | No | Yes | Recommendation text. |

#### Request Example

```json
{
  "title": "Front Brake Pads",
  "category": "Brakes",
  "severity": "medium",
  "status": "pending",
  "notes": "Pads worn below threshold",
  "recommendedAction": "Replace front brake pads"
}
```

### C) Update Line Items

#### Endpoints
- `PATCH /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items`
- `PATCH /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items/{lineItemId}`

#### Request Body Schema (typical)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| status | string | No | Yes | Updated status. |
| notes | string | No | Yes | Updated notes. |
| severity | string | No | Yes | Updated severity. |
| recommendedAction | string | No | Yes | Updated recommendation. |

### D) Delete Line Item

#### Endpoint
- `DELETE /api/company/{companyId}/workshop/inspections/{inspectionId}/line-items/{lineItemId}`

#### Success Response (typical)

```json
{
  "ok": true
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid line item payload" }` |
| 404 | `{ "error": "Line item not found" }` |
| 500 | `{ "error": "Failed to process line item" }` |
