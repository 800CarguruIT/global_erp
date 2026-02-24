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
