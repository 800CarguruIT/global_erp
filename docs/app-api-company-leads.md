# App API

## Scope: Company

## Module Name: Leads

## Version

- Version: v1
- Last updated: 2026-02-23

## Endpoint Index

| Name | Method | Endpoint |
| --- | --- | --- |
| List Leads | GET | `/api/company/{companyId}/crm/leads` |
| Create Lead | POST | `/api/company/{companyId}/crm/leads` |

## Implemented Requests (Current Route Handlers)

| Endpoint | Methods |
| --- | --- |
| `/api/company/{companyId}/crm/leads` | `GET`, `POST`, `DELETE` |
| `/api/company/{companyId}/crm/leads/{leadId}` | `GET`, `PATCH`, `DELETE` |
| `/api/company/{companyId}/crm/leads/{leadId}/events` | `GET` |
| `/api/company/{companyId}/sales/leads` | `GET`, `POST`, `DELETE` |
| `/api/company/{companyId}/sales/leads/{id}` | `GET`, `PUT`, `DELETE` |
| `/api/company/{companyId}/sales/leads/{id}/car-check` | `POST` |
| `/api/company/{companyId}/sales/leads/{id}/customer-visibility` | `POST` |
| `/api/company/{companyId}/sales/leads/{id}/request-customer` | `POST` |

## Workflow Sequence

`Customer/Car Input -> Create Lead -> Append Event -> Return Lead`

## 1. Name: List Leads

### Description
Return all company leads.

### Request Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | None | Company ID. |

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data | array | No | Lead list. |
| data[].id | string (uuid) | No | Lead ID. |
| data[].leadStatus | string | Yes | Current status. |
| data[].customerId | string | Yes | Customer ID. |
| data[].carId | string | Yes | Car ID. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 500 | `{ "error": "Failed to load leads" }` |

## 2. Name: Create Lead

### Description
Create lead using customer payload and optional car payload.

### Request Body Schema

| Field | Type | Required | Nullable | Default | Description |
| --- | --- | --- | --- | --- | --- |
| leadDivision | string | No | Yes | `rsa` | Lead type source. |
| leadCategory | string | No | Yes | null | Lead source/category. |
| assignTo | string (uuid) | No | Yes | null | Employee assignment. |
| agentRemarks | string | No | Yes | null | Internal remark. |
| customerRemarks | string | No | Yes | null | Customer remark. |
| customer | object | Yes | No | None | Customer payload. |
| customer.name | string | Conditional | Yes | null | Required if phone/email missing. |
| customer.phoneCode | string | No | Yes | null | Phone code. |
| customer.phoneNumber | string | No | Yes | null | Phone number. |
| customer.email | string | No | Yes | null | Email. |
| car | object | No | Yes | null | Optional car payload. |
| car.id | string (uuid) | No | Yes | null | Existing car ID to update/link. |
| car.plateNumber | string | No | Yes | null | Plate number. |
| car.vin | string | No | Yes | null | VIN. |
| car.make | string | No | Yes | null | Make. |
| car.model | string | No | Yes | null | Model. |
| car.year | number | No | Yes | null | Year. |

### Success Response Schema (201)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Lead ID. |
| data.customerId | string (uuid) | No | Customer ID. |
| data.carId | string (uuid) | Yes | Car ID. |
| data.leadStatus | string | Yes | Initial status. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Customer name or contact is required" }` |
| 500 | `{ "error": "Failed to create lead" }` |

## 3. Name: Update Lead

### Endpoint
- Method: `PATCH`
- URL: `/api/company/{companyId}/crm/leads/{leadId}`

### Description
Update lead fields such as status, assignment, and remarks.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| leadId (path) | string (uuid) | Yes | No | Lead ID. |
| leadStatus | string | No | Yes | Lead status update. |
| assignTo | string (uuid) | No | Yes | Employee assignment. |
| leadDivision | string | No | Yes | Division update (e.g. rsa/workshop). |
| leadCategory | string | No | Yes | Category/source update. |
| agentRemarks | string | No | Yes | Internal remarks. |
| customerRemarks | string | No | Yes | Customer-facing remarks. |

### Request Example

```json
{
  "leadStatus": "in_progress",
  "assignTo": "31d23635-72e3-4f73-b0b7-c1b70fd4f20a",
  "agentRemarks": "Advisor assigned and customer confirmed."
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Lead ID. |
| data.leadStatus | string | Yes | Updated status. |
| data.assignTo | string (uuid) | Yes | Assigned employee ID. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

### Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid lead update payload" }` |
| 404 | `{ "error": "Lead not found" }` |
| 500 | `{ "error": "Failed to update lead" }` |

## 4. Name: Delete Lead

### Endpoints
- `DELETE /api/company/{companyId}/crm/leads/{leadId}`
- `DELETE /api/company/{companyId}/crm/leads` (bulk/filtered handler)
- `DELETE /api/company/{companyId}/sales/leads/{id}`
- `DELETE /api/company/{companyId}/sales/leads`

### Description
Remove/deactivate leads based on module policy.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| leadId/id (path) | string (uuid) | Conditional | No | Required for single delete routes. |

### Success Response (typical)

```json
{
  "ok": true
}
```

### Error Response Schema

| Code | Shape |
| --- | --- |
| 404 | `{ "error": "Lead not found" }` |
| 409 | `{ "error": "Lead cannot be deleted in current status" }` |
| 500 | `{ "error": "Failed to delete lead" }` |

## 5. Name: Sales Lead Update

### Endpoint
- Method: `PUT`
- URL: `/api/company/{companyId}/sales/leads/{id}`

### Description
Replace/update sales lead record with validated payload.

### Request Schema

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| companyId (path) | string (uuid) | Yes | No | Company ID. |
| id (path) | string (uuid) | Yes | No | Sales lead ID. |
| leadStatus | string | No | Yes | Updated status. |
| assignTo | string (uuid) | No | Yes | Employee assignment. |
| customerRemarks | string | No | Yes | Customer remarks. |
| agentRemarks | string | No | Yes | Internal remarks. |
| carId | string (uuid) | No | Yes | Linked car ID. |

### Request Example

```json
{
  "leadStatus": "ready_for_inspection",
  "assignTo": "31d23635-72e3-4f73-b0b7-c1b70fd4f20a",
  "agentRemarks": "Moved to workshop queue."
}
```

### Success Response Schema (200)

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| data.id | string (uuid) | No | Sales lead ID. |
| data.leadStatus | string | Yes | Updated status. |
| data.updatedAt | string (ISO datetime) | Yes | Update timestamp. |

## 6. Name: Lead Events and Actions

### Endpoints
- `GET /api/company/{companyId}/crm/leads/{leadId}/events`
- `POST /api/company/{companyId}/sales/leads/{id}/car-check`
- `POST /api/company/{companyId}/sales/leads/{id}/customer-visibility`
- `POST /api/company/{companyId}/sales/leads/{id}/request-customer`

### Description
Read event timeline and execute lead workflow actions.

### Request/Response Details

#### A) Get Lead Events
- Endpoint: `GET /api/company/{companyId}/crm/leads/{leadId}/events`
- Success: event timeline entries for the lead.

#### B) Car Check Action
- Endpoint: `POST /api/company/{companyId}/sales/leads/{id}/car-check`
- Typical body: `{ "result": "pass", "note": "..." }`

#### C) Customer Visibility Action
- Endpoint: `POST /api/company/{companyId}/sales/leads/{id}/customer-visibility`
- Typical body: `{ "visible": true }`

#### D) Request Customer Action
- Endpoint: `POST /api/company/{companyId}/sales/leads/{id}/request-customer`
- Typical body: `{ "channel": "sms", "message": "Please share documents." }`

### Common Error Response Schema

| Code | Shape |
| --- | --- |
| 400 | `{ "error": "Invalid action payload" }` |
| 404 | `{ "error": "Lead not found" }` |
| 500 | `{ "error": "Failed to process lead action" }` |
