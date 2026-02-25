# Mobile API

## Scope: Global

## Module Name: Users

## Version

- Version: v1
- Last updated: 2026-02-24

## Endpoint Index

| Name | Method | Endpoint | Auth |
| --- | --- | --- | --- |
| Login | POST | `/api/mobile/auth/login` | Public |
| Get User | GET | `/api/mobile/auth/me` | Bearer access token |
| Refresh Token | POST | `/api/mobile/auth/refresh` | Refresh token in body |
| Logout | POST | `/api/mobile/auth/logout` | Optional bearer |
| Get Permissions Catalog | GET | `/api/mobile/auth/permissions` | Public |
| Get My Permissions | GET | `/api/mobile/auth/permissions/me` | Bearer access token |
| Get My Companies | GET | `/api/mobile/auth/my-companies` | Bearer access token |

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/mobile/auth/login` | `POST` |
| `/api/mobile/auth/me` | `GET` |
| `/api/mobile/auth/refresh` | `POST` |
| `/api/mobile/auth/logout` | `POST` |
| `/api/mobile/auth/permissions` | `GET` |
| `/api/mobile/auth/permissions/me` | `GET` |
| `/api/mobile/auth/my-companies` | `GET` |

## Workflow Sequence

`Login -> Access Token -> Resolve User Profile/Scope -> Permissions -> Company Context`

## 1. Name: Login

### Description
Authenticate mobile user and issue access + refresh tokens.

### Endpoint
- Method: `POST`
- URL: `/api/mobile/auth/login`

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| email | string | Yes | User email (trimmed + lowercase). |
| password | string | Yes | Plain-text password for verification. |

### Request Example

```json
{
  "email": "admin@globalerp.com",
  "password": "P@ssw0rd!"
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` when login succeeds. |
| data.tokenType | string | No | Always `Bearer`. |
| data.accessToken | string | No | Short-lived JWT access token. |
| data.refreshToken | string | No | Refresh JWT token. |
| data.expiresIn | number | No | Access token TTL (seconds). |
| data.refreshExpiresIn | number | No | Refresh token TTL (seconds). |
| data.user | object | Yes | Mobile profile payload. |
| data.redirect | string | Yes | Suggested first app route. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "success": false, "error": "email and password are required" }` |
| 401 | `{ "success": false, "error": "Invalid credentials" }` |
| 500 | `{ "success": false, "error": "User profile missing" }` |

## 2. Name: Get User

### Description
Resolve the current user profile from bearer token.

### Endpoint
- Method: `GET`
- URL: `/api/mobile/auth/me`

### Request Headers

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| Authorization | string | Yes | `Bearer <accessToken>`. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` on success. |
| data.userId | string (uuid) | No | Current user ID. |
| data.user | object | Yes | User profile object. |
| data.user.roles | array | No | Assigned role objects. |
| data.user.permissions | array | No | Effective permission keys. |
| data.user.companyScopes | array | Yes | Scoped company/branch/vendor mappings. |
| data.redirect | string | Yes | Suggested app route by role/scope. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |

## 3. Name: Refresh Token

### Description
Issue a new access token + refresh token pair.

### Endpoint
- Method: `POST`
- URL: `/api/mobile/auth/refresh`

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| refreshToken | string | Yes | JWT refresh token from prior login/refresh. |

### Request Example

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` on success. |
| data.tokenType | string | No | Always `Bearer`. |
| data.accessToken | string | No | New access token. |
| data.refreshToken | string | No | Rotated refresh token. |
| data.expiresIn | number | No | Access token TTL (seconds). |
| data.refreshExpiresIn | number | No | Refresh token TTL (seconds). |
| data.user | object | Yes | Fresh user profile payload. |
| data.redirect | string | Yes | Suggested app route. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "success": false, "error": "refreshToken is required" }` |
| 401 | `{ "success": false, "error": "Invalid refresh token" }` |
| 500 | `{ "success": false, "error": "Failed to refresh" }` |

## 4. Name: Logout

### Description
Stateless mobile logout acknowledgment. Client clears stored tokens.

### Endpoint
- Method: `POST`
- URL: `/api/mobile/auth/logout`

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| - | - | No | No request body required. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` on success. |
| data.ok | boolean | No | Always `true`. |

## 5. Name: Get Permissions Catalog

### Description
List permission definitions for a given scope.

### Endpoint
- Method: `GET`
- URL: `/api/mobile/auth/permissions?scope={global|company|branch|vendor}`

### Request Query

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| scope | string | No | Defaults to `global` if omitted. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` on success. |
| data.permissions | array<object> | No | Permission records for selected scope. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 500 | `{ "success": false, "error": "Failed to load permissions" }` |

## 6. Name: Get My Permissions

### Description
Resolve effective permissions for the current user in a target scope.

### Endpoint
- Method: `GET`
- URL: `/api/mobile/auth/permissions/me`

### Request Query

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| scope | string | No | `global`/`company`/`branch`/`vendor` (default: `global`). |
| companyId | string (uuid) | Conditionally | Required when scope is not global and cannot be inferred. |
| branchId | string (uuid) | No | Optional branch context. |
| vendorId | string (uuid) | No | Optional vendor context. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` on success. |
| data.permissions | array<string> | No | Effective permission keys for selected scope context. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "success": false, "error": "companyId is required" }` |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
| 500 | `{ "success": false, "error": "Failed to load permissions" }` |

## 7. Name: Get My Companies

### Description
Get user context and assigned company mappings.

### Endpoint
- Method: `GET`
- URL: `/api/mobile/auth/my-companies`

### Request Headers

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| Authorization | string | Yes | `Bearer <accessToken>`. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| success | boolean | No | `true` on success. |
| data.isGlobal | boolean | No | Whether user is global scope. |
| data.scope | string | No | Resolved primary scope. |
| data.companies | array<object> | No | Company mappings. |
| data.primaryCompany | object | Yes | First company mapping or `null`. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "success": false, "error": "Unauthorized" }` |
