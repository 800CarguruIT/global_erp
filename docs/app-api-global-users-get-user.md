# App API

## Scope: Global

## Module Name: Users

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint | Auth Scope |
| --- | --- | --- | --- |
| Get User | GET | `/api/admin/users/{id}` | Global (`global.admin`) |

## Workflow Sequence

`Auth -> Validate Permission -> Fetch User -> Return Data`

## 1. Name: Get User

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
