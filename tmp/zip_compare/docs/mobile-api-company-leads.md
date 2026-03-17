# Mobile API

## Scope: Company

## Module Name: Leads

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Leads | GET | `/api/mobile/company/{companyId}/leads` |

## Workflow Sequence

`Mobile Auth -> Company Access Check -> Filter Leads -> Return Enriched List`

## 1. Name: Get Leads

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |
| q (query) | string | No | Yes | null | Search text. |
| status (query) | string | No | Yes | null | Lead status filter. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True on success. |
| data.leads | array | No | Lead list. |
| data.leads[].id | string (uuid) | No | Lead ID. |
| data.leads[].leadStatus | string | Yes | Lead status. |
| data.leads[].customerWalletAmount | number | No | Wallet amount. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "success": false, "error": "companyId is required" }` |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 403 | `{ "success": false, "error": "Forbidden" }` |
| 500 | `{ "success": false, "error": "Unexpected error" }` |
