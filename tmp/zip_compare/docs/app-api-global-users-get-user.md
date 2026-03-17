# App API

## Scope: Global

## Module Name: Users

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint | Auth Scope |
| --- | --- | --- | --- |
| Create User | POST | `/api/admin/users` | Global (`global.admin`) |
| Get User | GET | `/api/admin/users/{id}` | Global (`global.admin`) |
| Update User | PUT | `/api/admin/users/{id}` | Global (`global.admin`) |
| Delete User | DELETE | `/api/admin/users/{id}` | Global (`global.admin`) |
| Update User Roles | PUT | `/api/auth/users/{id}/roles` | Global (`global.admin`) |

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/admin/users` | `GET`, `POST` |
| `/api/admin/users/{id}` | `GET`, `PUT`, `DELETE` |
| `/api/auth/users` | `POST` |
| `/api/auth/users/{id}/roles` | `GET`, `PUT` |
| `/api/auth/users/{id}/link-employee` | `POST` |

## Workflow Sequence

`Auth -> Validate Permission -> Create/Fetch/Update User -> Return Data`

## 1. Name: Create User

### Description
Create a new global user.

### Endpoint
- Method: `POST`
- URL: `/api/admin/users`

### Request Body (typical)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| email | string | Yes | User email (unique). |
| full_name | string | No | Full name. |
| mobile | string | No | Mobile number. |
| is_active | boolean | No | Initial status. |
| roleIds | array<string> | No | Initial role assignments. |

### Success Response Schema (201)

| Field | Type | Description |
| --- | --- | --- |
| data.id | string (uuid) | Created user ID. |
| data.email | string | Created email. |
| data.full_name | string | Full name. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid payload" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 409 | `{ "error": "Email already exists" }` |
| 500 | `{ "error": "Failed to create user" }` |

## 2. Name: Get User

### Description
Fetch a single global user by user ID.

### Endpoint
- Method: `GET`
- URL: `/api/admin/users/{id}`

### Request Schema

#### Headers

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Authorization | string | Yes | No | None | Bearer/session auth with `global.admin`. |

#### Path Params

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | string (uuid) | Yes | No | None | User ID. |

#### Request Body

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | No request body. |

### Request Example

```http
GET /api/admin/users/6a5e87bb-3c1e-4dc2-88ff-7938e9f40f75 HTTP/1.1
Authorization: Bearer <token>
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | User ID. |
| data.email | string | No | User email. |
| data.full_name | string | Yes | Full name. |
| data.is_active | boolean | No | Active status. |
| data.employee_id | string | Yes | Linked employee ID. |
| data.created_at | string (ISO datetime) | Yes | Creation time. |
| data.updated_at | string (ISO datetime) | Yes | Last update time. |
| data.company_id | string | Yes | Company scope ID. |
| data.mobile | string | Yes | Mobile number. |
| data.roles | array | Yes | Role list. |
| data.roles[].id | string (uuid) | No | Role ID. |
| data.roles[].name | string | No | Role name. |

### Success Response Example (200)

```json
{
  "data": {
    "id": "6a5e87bb-3c1e-4dc2-88ff-7938e9f40f75",
    "email": "admin@globalerp.com",
    "full_name": "Global Admin",
    "is_active": true,
    "employee_id": null,
    "created_at": "2026-02-20T08:15:00.000Z",
    "updated_at": "2026-02-22T14:33:41.000Z",
    "company_id": null,
    "mobile": "+971500000000",
    "roles": [
      {
        "id": "23f6fadb-ecf0-4c1a-9dc1-6ec74a39f2f5",
        "name": "Global Administrator"
      }
    ]
  }
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Not found" }` |
| 500 | `{ "error": "Failed to load user" }` |

### Error Response Example (404)

```json
{
  "error": "Not found"
}
```

## 3. Name: Update User

### Endpoint
- Method: `PUT`
- URL: `/api/admin/users/{id}`

### Description
Update user profile fields and active status.

### Request Schema

#### Headers

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Authorization | string | Yes | No | None | Bearer/session auth with global admin access. |
| Content-Type | string | Yes | No | `application/json` | JSON request body. |

#### Path Params

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | string (uuid) | Yes | No | None | Target user ID. |

#### Request Body

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| email | string | No | Yes | null | Updated email (must remain unique). |
| full_name | string | No | Yes | null | Updated full name. |
| mobile | string | No | Yes | null | Updated mobile number. |
| is_active | boolean | No | No | current | Activate/deactivate user access. |
| company_id | string (uuid) | No | Yes | null | Optional company scope mapping. |

### Request Example

```json
{
  "full_name": "Global Admin Updated",
  "mobile": "+971500000001",
  "is_active": true
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | User ID. |
| data.email | string | No | Updated email. |
| data.full_name | string | Yes | Updated full name. |
| data.mobile | string | Yes | Updated mobile number. |
| data.is_active | boolean | No | Updated status. |
| data.updated_at | string (ISO datetime) | Yes | Update timestamp. |

### Success Response Example (200)

```json
{
  "data": {
    "id": "6a5e87bb-3c1e-4dc2-88ff-7938e9f40f75",
    "email": "admin@globalerp.com",
    "full_name": "Global Admin Updated",
    "mobile": "+971500000001",
    "is_active": true,
    "updated_at": "2026-02-24T15:42:00.000Z"
  }
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid payload" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Not found" }` |
| 409 | `{ "error": "Email already exists" }` |
| 500 | `{ "error": "Failed to update user" }` |

## 4. Name: Delete User

### Endpoint
- Method: `DELETE`
- URL: `/api/admin/users/{id}`

### Description
Delete/deactivate a user record based on system policy.

### Request Schema

#### Headers

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Authorization | string | Yes | No | None | Bearer/session auth with global admin access. |

#### Path Params

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | string (uuid) | Yes | No | None | Target user ID. |

### Request Example

```http
DELETE /api/admin/users/6a5e87bb-3c1e-4dc2-88ff-7938e9f40f75 HTTP/1.1
Authorization: Bearer <token>
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| ok | boolean | No | Operation status. |
| message | string | Yes | Optional result message. |

### Success Response Example (200)

```json
{
  "ok": true,
  "message": "User deleted"
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Not found" }` |
| 409 | `{ "error": "Cannot delete protected user" }` |
| 500 | `{ "error": "Failed to delete user" }` |

## 5. Name: Update User Roles

### Endpoint
- Method: `PUT`
- URL: `/api/auth/users/{id}/roles`

### Description
Replace assigned roles for a user by role IDs.

### Request Schema

#### Headers

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Authorization | string | Yes | No | None | Bearer/session auth with global admin access. |
| Content-Type | string | Yes | No | `application/json` | JSON request body. |

#### Path Params

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | string (uuid) | Yes | No | None | Target user ID. |

#### Request Body

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| roleIds | array<string (uuid)> | Yes | No | None | Full role set to assign to the user (replace mode). |

### Request Example

```json
{
  "roleIds": [
    "23f6fadb-ecf0-4c1a-9dc1-6ec74a39f2f5",
    "b5929ac7-d02f-4b97-b5d5-8f7f3e7f74aa"
  ]
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.userId | string (uuid) | No | Updated user ID. |
| data.roles | array | No | Updated role assignments. |
| data.roles[].id | string (uuid) | No | Role ID. |
| data.roles[].name | string | No | Role name. |

### Success Response Example (200)

```json
{
  "data": {
    "userId": "6a5e87bb-3c1e-4dc2-88ff-7938e9f40f75",
    "roles": [
      {
        "id": "23f6fadb-ecf0-4c1a-9dc1-6ec74a39f2f5",
        "name": "Global Administrator"
      },
      {
        "id": "b5929ac7-d02f-4b97-b5d5-8f7f3e7f74aa",
        "name": "Support Manager"
      }
    ]
  }
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid roleIds payload" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "User not found" }` |
| 500 | `{ "error": "Failed to update user roles" }` |
