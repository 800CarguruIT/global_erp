# Mobile API

## Scope: Company

## Module Name: Inventory

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get Parts Selector Data | GET | `/api/mobile/company/{companyId}/selectors/parts` |

## Workflow Sequence

`Mobile Auth -> Access Check -> Load Parts Requirements -> Return`

## 1. Name: Get Parts Selector Data

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True. |
| data.parts | array | No | Parts list. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 403 | `{ "success": false, "error": "Forbidden" }` |
| 500 | `{ "success": false, "error": "Unexpected error" }` |
