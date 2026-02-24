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
