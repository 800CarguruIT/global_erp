# App API

## Scope: Company

## Module Name: Inventory

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Stock | GET | `/api/company/{companyId}/workshop/inventory/stock` |

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/inventory/products-tree` | `GET` |
| `/api/company/{companyId}/workshop/inventory/stock` | `GET` |
| `/api/company/{companyId}/workshop/inventory/movements` | `GET` |
| `/api/company/{companyId}/workshop/inventory/ai-summary` | `GET` |
| `/api/company/{companyId}/workshop/inventory/manual/receive` | `POST` |
| `/api/company/{companyId}/workshop/inventory/manual/issue` | `POST` |
| `/api/company/{companyId}/workshop/inventory/parts` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/parts/{partId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/locations` | `GET`, `POST`, `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/transfers` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/transfers/{transferId}` | `GET`, `PATCH` |
| `/api/company/{companyId}/workshop/inventory/order-requests` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/order-requests/{requestId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/types` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/types/{typeId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/categories` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/categories/{categoryId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/subcategories` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/subcategories/{subcategoryId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/makes` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/makes/{makeId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/models` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/models/{modelId}` | `PATCH`, `DELETE` |
| `/api/company/{companyId}/workshop/inventory/years` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/inventory/years/{yearId}` | `PATCH`, `DELETE` |

## Workflow Sequence

`Receive/Issue/Transfer Movements -> Query Stock -> Return Filtered Availability`

## 1. Name: Get Stock

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| locationId | string (uuid) | No | Yes | null | Location filter. |
| q | string | No | Yes | null | Search term. |
| typeId | string (uuid) | No | Yes | null | Type filter. |
| categoryId | string (uuid) | No | Yes | null | Category filter. |
| subcategoryId | string (uuid) | No | Yes | null | Subcategory filter. |
| makeId | string (uuid) | No | Yes | null | Make filter. |
| modelId | string (uuid) | No | Yes | null | Model filter. |
| yearId | string (uuid) | No | Yes | null | Year filter. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Stock rows. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 200 | `{ "data": [], "error": "stock_unavailable" }` |

## 2. Name: Master Data CRUD (Types/Categories/Make/Model/Year/Location)

### Endpoints
- `GET|POST /api/company/{companyId}/workshop/inventory/types`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/types/{typeId}`
- `GET|POST /api/company/{companyId}/workshop/inventory/categories`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/categories/{categoryId}`
- `GET|POST /api/company/{companyId}/workshop/inventory/subcategories`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/subcategories/{subcategoryId}`
- `GET|POST /api/company/{companyId}/workshop/inventory/makes`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/makes/{makeId}`
- `GET|POST /api/company/{companyId}/workshop/inventory/models`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/models/{modelId}`
- `GET|POST /api/company/{companyId}/workshop/inventory/years`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/years/{yearId}`
- `GET|POST|PATCH|DELETE /api/company/{companyId}/workshop/inventory/locations`

### Description
Manage inventory structure dictionaries used by parts and stock records.

### Request Schema (common)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| id path (`typeId/categoryId/...`) | string (uuid) | Conditional | No | Required for PATCH/DELETE item routes. |
| name | string | Required for POST | Yes | Display name. |
| code | string | No | Yes | Unique short code. |
| isActive | boolean | No | Yes | Active flag. |
| sortOrder | number | No | Yes | UI ordering index. |

### Request Example (POST)

```json
{
  "name": "Engine Parts",
  "code": "ENG",
  "isActive": true
}
```

### Success Response Schema (200/201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Created/updated dictionary item id. |
| data.name | string | No | Name. |
| data.code | string | Yes | Code. |
| data.isActive | boolean | Yes | Active status. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid master data payload" }` |
| 404 | `{ "error": "Master data item not found" }` |
| 409 | `{ "error": "Duplicate code/name" }` |
| 500 | `{ "error": "Failed to process master data request" }` |

## 3. Name: Parts CRUD

### Endpoints
- `GET|POST /api/company/{companyId}/workshop/inventory/parts`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/parts/{partId}`

### Description
Create and maintain part master records.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| partId (path) | Conditional | Conditional | No | Required for PATCH/DELETE. |
| sku | string | Yes (POST) | No | Item SKU code. |
| partName | string | Yes (POST) | No | Part display name. |
| typeId | string (uuid) | No | Yes | Part type. |
| categoryId | string (uuid) | No | Yes | Category. |
| subcategoryId | string (uuid) | No | Yes | Subcategory. |
| makeId | string (uuid) | No | Yes | Vehicle make mapping. |
| modelId | string (uuid) | No | Yes | Vehicle model mapping. |
| yearId | string (uuid) | No | Yes | Vehicle year mapping. |
| unit | string | No | Yes | Unit of measure. |
| isActive | boolean | No | Yes | Active status. |

### Request Example (POST)

```json
{
  "sku": "BP-1002",
  "partName": "Front Brake Pad Set",
  "categoryId": "73e99184-eecf-4e8b-b2cb-c473ad11c2d6",
  "unit": "set",
  "isActive": true
}
```

### Success Response Schema (200/201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Part id. |
| data.sku | string | No | SKU. |
| data.partName | string | No | Part name. |
| data.isActive | boolean | Yes | Status. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid part payload" }` |
| 404 | `{ "error": "Part not found" }` |
| 409 | `{ "error": "Part sku already exists" }` |
| 500 | `{ "error": "Failed to process part request" }` |

## 4. Name: Movement Operations

### Endpoints
- `POST /api/company/{companyId}/workshop/inventory/manual/receive`
- `POST /api/company/{companyId}/workshop/inventory/manual/issue`
- `GET|POST /api/company/{companyId}/workshop/inventory/transfers`
- `GET|PATCH /api/company/{companyId}/workshop/inventory/transfers/{transferId}`
- `GET /api/company/{companyId}/workshop/inventory/movements`

### Description
Record receive/issue/transfer actions and audit stock movement timeline.

### Receive / Issue Request Body (typical)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| partId | string (uuid) | Yes | No | Part ID. |
| locationId | string (uuid) | Yes | No | Source/target location. |
| quantity | number | Yes | No | Quantity moved. |
| unitCost | number | No | Yes | Unit cost (receive flow). |
| reason | string | No | Yes | Movement reason/comment. |
| referenceNo | string | No | Yes | External/internal reference. |

### Transfer Request Body (POST)

```json
{
  "partId": "ca0f6c4f-c63d-4efe-aef1-7fd0f5fdd8f2",
  "fromLocationId": "e5ca1973-6650-44dc-b6e0-f1e4e1f48947",
  "toLocationId": "289a71f8-469e-4785-91d3-4f59dafc2c01",
  "quantity": 2,
  "reason": "Branch stock balancing"
}
```

### Success Response Schema (200/201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Movement/transfer id. |
| data.status | string | Yes | Processing status. |
| data.quantity | number | Yes | Processed quantity. |
| data.createdAt | string (ISO datetime) | Yes | Timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid movement payload" }` |
| 409 | `{ "error": "Insufficient stock" }` |
| 500 | `{ "error": "Failed to process movement" }` |

## 5. Name: Order Requests

### Endpoints
- `GET|POST /api/company/{companyId}/workshop/inventory/order-requests`
- `PATCH|DELETE /api/company/{companyId}/workshop/inventory/order-requests/{requestId}`

### Description
Create and manage internal stock replenishment requests.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| requestId (path) | Conditional | Conditional | No | Required for PATCH/DELETE. |
| partId | string (uuid) | Yes (POST) | No | Required part. |
| locationId | string (uuid) | Yes (POST) | No | Requesting location. |
| quantity | number | Yes (POST) | No | Requested quantity. |
| priority | string | No | Yes | Priority level. |
| note | string | No | Yes | Request note. |
| status | string | No | Yes | Used in PATCH to change status. |

### Request Example (POST)

```json
{
  "partId": "ca0f6c4f-c63d-4efe-aef1-7fd0f5fdd8f2",
  "locationId": "289a71f8-469e-4785-91d3-4f59dafc2c01",
  "quantity": 4,
  "priority": "high",
  "note": "Urgent for active job cards"
}
```

### Success Response Schema (200/201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Order request id. |
| data.status | string | No | Request status. |
| data.quantity | number | No | Requested quantity. |
| data.createdAt | string (ISO datetime) | Yes | Creation time. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid order request payload" }` |
| 404 | `{ "error": "Order request not found" }` |
| 500 | `{ "error": "Failed to process order request" }` |
