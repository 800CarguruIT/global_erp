# Mobile API

## Scope: Company

## Module Name: Procurement

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Vendor Inquiries | GET | `/api/mobile/company/{companyId}/vendors/{vendorId}/inquiries` |

## Workflow Sequence

`Mobile Auth -> Access Check -> Aggregate Inquiry Sources -> Return`

## 1. Name: Get Vendor Inquiries

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| vendorId (path) | string (uuid) | Yes | No | None | Vendor ID. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True. |
| data.inquiries | array | No | Inquiry list. |
| data.inquiries[].inquiryId | string (uuid) | No | Inquiry ID. |
| data.inquiries[].sourceType | string | No | `estimate` or `inventory`. |
| data.inquiries[].requestNumber | string | Yes | Inventory request number. |
| data.inquiries[].updatedAt | string (ISO datetime) | No | Last update time. |
| data.inquiries[].carMake | string | Yes | Car make. |
| data.inquiries[].carModel | string | Yes | Car model. |
| data.inquiries[].carPlate | string | Yes | Car plate. |
| data.inquiries[].carVin | string | Yes | Car VIN. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 403 | `{ "success": false, "error": "Forbidden" }` |
| 500 | `{ "success": false, "error": "Unexpected error" }` |
