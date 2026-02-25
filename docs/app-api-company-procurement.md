# App API

## Scope: Company

## Module Name: Procurement

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| List Purchase Orders | GET | `/api/company/{companyId}/workshop/procurement` |
| Create Purchase Order | POST | `/api/company/{companyId}/workshop/procurement` |

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/workshop/procurement` | `GET`, `POST` |
| `/api/company/{companyId}/workshop/procurement/{poId}` | `GET`, `PATCH` |
| `/api/company/{companyId}/workshop/procurement/{poId}/receive` | `POST` |
| `/api/company/{companyId}/workshop/procurement/{poId}/reconcile-grn` | `POST` |
| `/api/company/{companyId}/workshop/procurement/{poId}/move-to-inventory` | `POST` |
| `/api/company/{companyId}/workshop/procurement/{poId}/grn/pdf` | `GET` |
| `/api/company/{companyId}/workshop/procurement/next-po-number` | `GET` |
| `/api/company/{companyId}/workshop/procurement/ai-summary` | `GET` |
| `/api/company/{companyId}/part-quotes` | `GET` |
| `/api/company/{companyId}/part-quotes/order` | `POST` |
| `/api/company/{companyId}/vendors/{vendorId}/inquiries` | `GET` |
| `/api/company/{companyId}/vendors/{vendorId}/inquiries/{estimateId}/parts` | `GET` |
| `/api/company/{companyId}/vendors/{vendorId}/bids` | `GET` |

## Workflow Sequence

`Inquiry/Quote -> PO Create -> Order -> Receive -> Reconcile`

## 1. Name: List Purchase Orders

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| status (query) | string | No | Yes | null | PO status filter. |
| vendorId (query) | string (uuid) | No | Yes | null | Vendor filter. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Purchase orders. |

## 2. Name: Create Purchase Order

### Request Body Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| mode | string | No | No | `manual` | `fromQuote` or manual. |
| quoteId | string (uuid) | Conditional | Yes | null | Required for `fromQuote`. |
| poType | string | No | No | `po` | PO type. |
| vendorId | string (uuid) | No | Yes | null | Vendor ID in manual mode. |
| vendorName | string | No | Yes | null | Vendor name. |
| vendorContact | string | No | Yes | null | Vendor contact. |
| currency | string | No | Yes | null | Currency. |
| items | array | No | No | [] | Manual items payload. |

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | object | No | Created PO payload. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `"quoteId required"` |
| 500 | `{ "error": "Failed to create purchase order" }` |

## 3. Name: Get / Update Purchase Order

### Endpoints
- `GET /api/company/{companyId}/workshop/procurement/{poId}`
- `PATCH /api/company/{companyId}/workshop/procurement/{poId}`

### Description
Fetch PO detail and update PO status/metadata.

### A) Get Purchase Order

#### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| poId (path) | string (uuid) | Yes | No | Purchase order ID. |

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | PO ID. |
| data.poNumber | string | Yes | PO number. |
| data.status | string | No | PO status. |
| data.vendorId | string (uuid) | Yes | Vendor ID. |
| data.items | array | Yes | PO line items. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### B) Update Purchase Order (PATCH)

#### Request Body Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| status | string | No | Yes | Updated PO status. |
| expectedDate | string (ISO datetime) | No | Yes | Expected delivery date. |
| note | string | No | Yes | Internal note. |
| vendorReference | string | No | Yes | Vendor reference number. |

#### Request Example

```json
{
  "status": "ordered",
  "expectedDate": "2026-02-28T00:00:00.000Z",
  "note": "Vendor confirmed shipment."
}
```

#### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | PO ID. |
| data.status | string | No | Updated status. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid purchase order update payload" }` |
| 404 | `{ "error": "Purchase order not found" }` |
| 500 | `{ "error": "Failed to update purchase order" }` |

## 4. Name: Receiving and Reconciliation

### Endpoints
- `POST /api/company/{companyId}/workshop/procurement/{poId}/receive`
- `POST /api/company/{companyId}/workshop/procurement/{poId}/reconcile-grn`
- `POST /api/company/{companyId}/workshop/procurement/{poId}/move-to-inventory`

### Description
Receive ordered parts, reconcile GRN, and move stock into inventory balances.

### Request Schema (common)

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| poId (path) | string (uuid) | Yes | No | Purchase order ID. |
| items | array | Yes | No | Received/reconciled item rows. |
| items[].partId | string (uuid) | Yes | No | Part ID. |
| items[].quantity | number | Yes | No | Quantity processed. |
| items[].unitCost | number | No | Yes | Unit cost when applicable. |
| note | string | No | Yes | Operation note. |

### Request Example (`/receive`)

```json
{
  "items": [
    {
      "partId": "ca0f6c4f-c63d-4efe-aef1-7fd0f5fdd8f2",
      "quantity": 2,
      "unitCost": 120
    }
  ],
  "note": "First partial delivery"
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.poId | string (uuid) | No | PO ID. |
| data.status | string | Yes | Updated procurement status. |
| data.grnId | string (uuid) | Yes | GRN ID (receive/reconcile). |
| data.inventoryMovementId | string (uuid) | Yes | Movement ID (move-to-inventory). |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid receive/reconcile payload" }` |
| 409 | `{ "error": "Quantity exceeds ordered quantity" }` |
| 500 | `{ "error": "Failed to process procurement receiving flow" }` |

## 5. Name: Procurement Utility Endpoints

### Endpoints
- `GET /api/company/{companyId}/workshop/procurement/next-po-number`
- `GET /api/company/{companyId}/workshop/procurement/ai-summary`
- `GET /api/company/{companyId}/workshop/procurement/{poId}/grn/pdf`

### Description
Provide numbering, analytics, and printable GRN output.

### Response Summary

| Endpoint | Typical Response |
| --- | --- |
| `GET /next-po-number` | `{ "data": { "nextPoNumber": "PO-2026-000145" } }` |
| `GET /ai-summary` | `{ "data": { "insights": [...], "risks": [...] } }` |
| `GET /{poId}/grn/pdf` | PDF file/binary response |

## 6. Name: Quote and Vendor Inputs

### Endpoints
- `GET /api/company/{companyId}/part-quotes`
- `POST /api/company/{companyId}/part-quotes/order`
- `GET /api/company/{companyId}/vendors/{vendorId}/inquiries`
- `GET /api/company/{companyId}/vendors/{vendorId}/inquiries/{estimateId}/parts`
- `GET /api/company/{companyId}/vendors/{vendorId}/bids`

### Description
Expose vendor quote streams and convert selected quotes into procurement orders.

### Request / Response Details

#### A) List Part Quotes
- Endpoint: `GET /api/company/{companyId}/part-quotes`
- Returns list of part quote rows and statuses.

#### B) Create Order from Quote
- Endpoint: `POST /api/company/{companyId}/part-quotes/order`
- Typical body: `{ "quoteId": "<uuid>", "selectedItems": [{ "partId": "...", "quantity": 2 }] }`

#### C) Vendor Inquiry Feeds
- `GET /api/company/{companyId}/vendors/{vendorId}/inquiries`
- `GET /api/company/{companyId}/vendors/{vendorId}/inquiries/{estimateId}/parts`
- `GET /api/company/{companyId}/vendors/{vendorId}/bids`

### Common Error Responses

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid quote/order payload" }` |
| 404 | `{ "error": "Quote or vendor data not found" }` |
| 500 | `{ "error": "Failed to process vendor input request" }` |
