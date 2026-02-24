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

## 2. Name: Create Recovery Request

### Endpoint
`POST /api/company/{companyId}/recovery-requests`

### Description
Create a recovery request linked to customer and vehicle context.

## 3. Name: Update Recovery Request

### Endpoint
`PUT /api/company/{companyId}/recovery-requests/{requestId}`

### Description
Update request details/status based on operations workflow.

## 4. Name: Verify Recovery Request

### Endpoint
`POST /api/company/{companyId}/recovery-requests/{requestId}/verify`

### Description
Verify request completion and finalize handover validation.
