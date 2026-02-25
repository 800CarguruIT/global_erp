# App API

## Scope: Company

## Module Name: Recovery Request

## Version

- Version: v1
- Last updated: 2026-02-24

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/recovery-requests` | `GET`, `POST` |
| `/api/company/{companyId}/recovery-requests/{requestId}` | `PUT` |
| `/api/company/{companyId}/recovery-requests/{requestId}/verify` | `POST` |

## Workflow Sequence

`Create Request -> Assign/Update -> Verify -> Complete`

## 1. Name: List Recovery Requests

### Endpoint
`GET /api/company/{companyId}/recovery-requests`

### Description
Return recovery requests by company scope with filters and paging.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| status (query) | string | No | Yes | Filter by request status. |
| priority (query) | string | No | Yes | Filter by priority. |
| branchId (query) | string (uuid) | No | Yes | Destination branch filter. |
| from (query) | string (ISO datetime) | No | Yes | Created from datetime. |
| to (query) | string (ISO datetime) | No | Yes | Created to datetime. |
| page (query) | number | No | Yes | Page number. |
| pageSize (query) | number | No | Yes | Page size. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Recovery request rows. |
| data[].id | string (uuid) | No | Request ID. |
| data[].requestNo | string | Yes | Request number. |
| data[].status | string | No | Request status. |
| data[].priority | string | Yes | Priority level. |
| data[].customerId | string (uuid) | Yes | Customer ID. |
| data[].carId | string (uuid) | Yes | Car ID. |
| data[].pickupLocation | string | Yes | Pickup address. |
| data[].destinationBranchId | string (uuid) | Yes | Destination branch. |
| data[].updatedAt | string (ISO datetime) | Yes | Last update timestamp. |
| pagination | object | Yes | Pagination object when paging enabled. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid query parameters" }` |
| 500 | `{ "error": "Failed to load recovery requests" }` |

## 2. Name: Create Recovery Request

### Endpoint
`POST /api/company/{companyId}/recovery-requests`

### Description
Create a recovery request linked to customer and vehicle context.

### Request Body Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| customerId | string (uuid) | Yes | No | Customer reference. |
| carId | string (uuid) | Yes | No | Car reference. |
| sourceLeadId | string (uuid) | No | Yes | Source lead (if any). |
| pickupLocation | string | Yes | No | Pickup location details. |
| destinationBranchId | string (uuid) | Yes | No | Destination branch ID. |
| priority | string | No | Yes | Priority (`low`, `normal`, `high`, `critical`). |
| requestedAt | string (ISO datetime) | No | Yes | Requested recovery time. |
| notes | string | No | Yes | Additional notes. |

### Request Example

```json
{
  "customerId": "d40a4f16-e9ab-4b63-a1fb-e3f4f5abf652",
  "carId": "f8f98739-5cb5-4dae-916e-3669f2f15f12",
  "sourceLeadId": "faaf3fcb-1c3f-4eb4-804f-6f9f18cfb20e",
  "pickupLocation": "Sheikh Zayed Road, Dubai",
  "destinationBranchId": "9ad2cd0f-1e90-4304-a4dc-4023dc87b260",
  "priority": "high",
  "requestedAt": "2026-02-24T16:30:00Z",
  "notes": "Vehicle not starting. Flatbed required."
}
```

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Created request ID. |
| data.requestNo | string | Yes | Generated request number. |
| data.status | string | No | Initial status. |
| data.createdAt | string (ISO datetime) | Yes | Creation timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid recovery request payload" }` |
| 404 | `{ "error": "Customer or car not found" }` |
| 500 | `{ "error": "Failed to create recovery request" }` |

## 3. Name: Update Recovery Request

### Endpoint
`PUT /api/company/{companyId}/recovery-requests/{requestId}`

### Description
Update request details/status based on operations workflow.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| requestId (path) | string (uuid) | Yes | No | Recovery request ID. |
| status | string | No | Yes | New status (`assigned`, `en_route`, `loaded`, `delivered`, etc.). |
| assignedUnitId | string (uuid) | No | Yes | Assigned recovery unit. |
| assignedDriverId | string (uuid) | No | Yes | Assigned driver. |
| etaMinutes | number | No | Yes | ETA in minutes. |
| note | string | No | Yes | Operations note. |

### Request Example

```json
{
  "status": "en_route",
  "assignedUnitId": "1f5b72f5-d1f4-4ec8-9348-6a27bbd0f6d8",
  "assignedDriverId": "0ece0f4b-0813-4b98-9851-174fce3f5f54",
  "etaMinutes": 35,
  "note": "Driver dispatched and route confirmed"
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Request ID. |
| data.status | string | No | Updated status. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid update payload" }` |
| 404 | `{ "error": "Recovery request not found" }` |
| 500 | `{ "error": "Failed to update recovery request" }` |

## 4. Name: Verify Recovery Request

### Endpoint
`POST /api/company/{companyId}/recovery-requests/{requestId}/verify`

### Description
Verify request completion and finalize handover validation.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| requestId (path) | string (uuid) | Yes | No | Recovery request ID. |
| verifiedBy | string (uuid) | Yes | No | Verifier user ID. |
| verificationNote | string | No | Yes | Verification comments. |
| deliveredAt | string (ISO datetime) | No | Yes | Actual delivery timestamp. |

### Request Example

```json
{
  "verifiedBy": "0ece0f4b-0813-4b98-9851-174fce3f5f54",
  "verificationNote": "Vehicle delivered to branch and received by supervisor.",
  "deliveredAt": "2026-02-24T17:42:00Z"
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Request ID. |
| data.status | string | No | Verified/final status. |
| data.verifiedAt | string (ISO datetime) | Yes | Verification timestamp. |
| data.verifiedBy | string (uuid) | Yes | Verifier user ID. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid verification payload" }` |
| 404 | `{ "error": "Recovery request not found" }` |
| 409 | `{ "error": "Request is not ready for verification" }` |
| 500 | `{ "error": "Failed to verify recovery request" }` |
