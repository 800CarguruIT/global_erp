# Mobile API

## Scope: Global

## Module Name: Users

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| Get User | GET | `/api/mobile/auth/me` |

## Workflow Sequence

`Mobile Token -> Resolve User Profile -> Return User + Redirect`

## 1. Name: Get User

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Authorization | string | Yes | No | None | Mobile bearer token. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | True on success. |
| data.userId | string (uuid) | No | Current user ID. |
| data.user | object | Yes | User profile object. |
| data.user.roles | array | No | Roles list. |
| data.user.permissions | array | No | Effective permissions. |
| data.redirect | string | Yes | Suggested app route. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 500 | `{ "success": false, "error": "Failed to load user" }` |
