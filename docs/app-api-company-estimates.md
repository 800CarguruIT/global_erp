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

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/workshop/estimates` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/estimates/{estimateId}` | `GET`, `PATCH` |
| `/api/company/{companyId}/workshop/estimates/{estimateId}/quote` | `GET` |

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

## 3. Name: Get / Update Estimate

### Endpoints
- `GET /api/company/{companyId}/workshop/estimates/{estimateId}`
- `PATCH /api/company/{companyId}/workshop/estimates/{estimateId}`

### Description
Fetch one estimate and update estimate header/status fields.

### A) Get Estimate

#### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| estimateId (path) | string (uuid) | Yes | No | Estimate ID. |

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Estimate ID. |
| data.status | string | No | Estimate status. |
| data.inspectionId | string (uuid) | Yes | Source inspection ID. |
| data.customerId | string (uuid) | Yes | Customer ID. |
| data.carId | string (uuid) | Yes | Car ID. |
| data.subtotal | number | Yes | Subtotal amount. |
| data.total | number | Yes | Total amount. |
| data.updatedAt | string (ISO datetime) | Yes | Last update timestamp. |

### B) Update Estimate

#### Request Body Schema (PATCH)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| status | string | No | Yes | Updated estimate status. |
| customerRemark | string | No | Yes | Customer-facing remark. |
| agentRemark | string | No | Yes | Internal remark. |
| approvalNote | string | No | Yes | Approval/rejection note. |
| validUntil | string (ISO datetime) | No | Yes | Quote validity date. |

#### Request Example

```json
{
  "status": "approved",
  "customerRemark": "Customer approved via phone.",
  "agentRemark": "Proceed to job card creation.",
  "approvalNote": "Approved by service manager"
}
```

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Estimate ID. |
| data.status | string | No | Updated status. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid estimate update payload" }` |
| 404 | `{ "error": "Estimate not found" }` |
| 500 | `{ "error": "Failed to update estimate" }` |

## 4. Name: Estimate Quote View

### Endpoint
- Method: `GET`
- URL: `/api/company/{companyId}/workshop/estimates/{estimateId}/quote`

### Description
Return quote/print-oriented estimate data payload for display/export.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| estimateId (path) | string (uuid) | Yes | No | Estimate ID. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.estimate | object | No | Estimate header for quote. |
| data.estimate.id | string (uuid) | No | Estimate ID. |
| data.estimate.status | string | No | Estimate status. |
| data.items | array | No | Quote line items. |
| data.items[].id | string (uuid) | No | Line item ID. |
| data.items[].description | string | Yes | Item description. |
| data.items[].quantity | number | Yes | Item quantity. |
| data.items[].unitPrice | number | Yes | Unit price. |
| data.items[].lineTotal | number | Yes | Line total. |
| data.totals | object | Yes | Totals summary (subtotal/tax/total). |

### Success Response Example (200)

```json
{
  "data": {
    "estimate": {
      "id": "2f2e1f9f-4c43-4b1e-b3d5-a10a9f2c1d20",
      "status": "approved"
    },
    "items": [
      {
        "id": "f15e886a-2660-4a74-88ec-e5d09b2ec0a8",
        "description": "Front brake pads",
        "quantity": 1,
        "unitPrice": 320,
        "lineTotal": 320
      }
    ],
    "totals": {
      "subtotal": 320,
      "tax": 16,
      "total": 336
    }
  }
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 404 | `{ "error": "Estimate not found" }` |
| 500 | `{ "error": "Failed to load estimate quote view" }` |
