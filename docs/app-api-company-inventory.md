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
