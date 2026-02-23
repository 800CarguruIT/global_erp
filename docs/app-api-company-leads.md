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
