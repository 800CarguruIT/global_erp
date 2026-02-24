# Recovery Request API

## Company Integration Guide

Scope: Company
Module Name: Recovery Request

## 1. Name: List Recovery Requests

Description:
Return paginated recovery requests with status and assignment details.

Endpoint:
`GET /api/company/{companyId}/recovery-requests`

### Request Query Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| page | number | No | Page number (default 1) |
| pageSize | number | No | Items per page |
| status | string | No | Filter by status |
| branchId | string (uuid) | No | Filter by destination branch |
| from | string (date-time) | No | Created from date |
| to | string (date-time) | No | Created to date |

### Response Body

| Field | Type | Description |
| --- | --- | --- |
| data | array | List of recovery requests |
| data[].id | string (uuid) | Recovery request id |
| data[].requestNo | string | Human-readable request number |
| data[].status | string | Current status |
| data[].customerName | string | Customer display name |
| data[].vehicleRef | string | Vehicle identifier |
| data[].pickupLocation | string | Pickup location text |
| data[].destinationBranchName | string | Destination branch |
| data[].assignedUnit | string | Assigned recovery unit |
| data[].updatedAt | string (date-time) | Last update timestamp |
| pagination | object | Pagination summary |

## 2. Name: Create Recovery Request

Description:
Create a new recovery request linked to customer, vehicle, and branch context.

Endpoint:
`POST /api/company/{companyId}/recovery-requests`

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| customerId | string (uuid) | Yes | Customer reference |
| carId | string (uuid) | Yes | Vehicle reference |
| sourceLeadId | string (uuid) | No | Optional lead link |
| pickupLocation | string | Yes | Pickup address or map text |
| destinationBranchId | string (uuid) | Yes | Destination branch |
| priority | enum | Yes | `low`, `normal`, `high`, `critical` |
| requestedAt | string (date-time) | No | Preferred recovery time |
| notes | string | No | Additional instructions |

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

### Response Body

| Field | Type | Description |
| --- | --- | --- |
| id | string (uuid) | Recovery request id |
| requestNo | string | Generated request number |
| status | string | Initial status, normally `new` |
| createdAt | string (date-time) | Creation timestamp |

## 3. Name: Assign Recovery Unit

Description:
Assign a recovery unit/driver and move request to operational state.

Endpoint:
`POST /api/company/{companyId}/recovery-requests/{requestId}/assign`

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| unitId | string (uuid) | Yes | Recovery unit reference |
| driverId | string (uuid) | No | Driver reference |
| etaMinutes | number | No | Estimated arrival in minutes |

### Response Body

| Field | Type | Description |
| --- | --- | --- |
| id | string (uuid) | Recovery request id |
| status | string | Updated status, typically `assigned` |
| assignedUnit | object | Assigned resource details |

## 4. Name: Update Recovery Status

Description:
Update workflow status during dispatch and transport.

Endpoint:
`PATCH /api/company/{companyId}/recovery-requests/{requestId}/status`

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| status | enum | Yes | `assigned`, `en_route`, `vehicle_loaded`, `delivered`, `closed`, `cancelled` |
| reason | string | Conditionally | Required for `cancelled` |
| note | string | No | Operational update note |

### Response Body

| Field | Type | Description |
| --- | --- | --- |
| id | string (uuid) | Recovery request id |
| status | string | Current status |
| updatedAt | string (date-time) | Status update timestamp |

## 5. Name: Get Recovery Request

Description:
Return full request detail including timeline.

Endpoint:
`GET /api/company/{companyId}/recovery-requests/{requestId}`

### Response Body

| Field | Type | Description |
| --- | --- | --- |
| id | string (uuid) | Recovery request id |
| requestNo | string | Request number |
| status | string | Current status |
| customer | object | Customer summary |
| vehicle | object | Vehicle summary |
| dispatch | object | Assignment and ETA details |
| timeline | array | Status and action history |

## Security and Governance Notes

- Company scope authorization is mandatory.
- Only permitted roles can assign or cancel.
- Every status change should be logged in audit timeline.
- Cancel action should require explicit reason.

## Summary

Recovery Request API provides end-to-end transport workflow integration: create, assign, track status, and close with full audit traceability.
