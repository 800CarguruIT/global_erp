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
