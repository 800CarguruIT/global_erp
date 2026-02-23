# Mobile API Atlas

All mobile routes live under `apps/web/app/api/mobile`. They assume JWT auth (`/api/mobile/auth/*`) and enforce the company scope via `ensureCompanyAccess`. Use the following list when wiring Postman, docs, or the mobile client.

## Authentication

| Purpose | Method | Path |
| --- | --- | --- |
| Login and receive access/refresh tokens | `POST` | `/api/mobile/auth/login` |
| Validate token and retrieve user/context | `GET` | `/api/mobile/auth/me` |
| Refresh tokens | `POST` | `/api/mobile/auth/refresh` |

## Inspections

| Purpose | Method | Path |
| --- | --- | --- |
| List company inspections with optional `status` | `GET` | `/api/mobile/company/{companyId}/inspections?status=...` |
| Fetch single inspection with line items | `GET` | `/api/mobile/company/{companyId}/inspections/{inspectionId}` |
| Update inspection metadata (status, draft payload, etc.) | `PATCH` | `/api/mobile/company/{companyId}/inspections/{inspectionId}` |

## Inspection Line Items

| Purpose | Method | Path | Notes |
| --- | --- | --- | --- |
| List line items for an inspection | `GET` | `/api/mobile/company/{companyId}/inspections/{inspectionId}/line-items?source=inspection` | `source` can also be `estimate` |
| Create a new line item | `POST` | `/api/mobile/company/{companyId}/inspections/{inspectionId}/line-items` | Provide `partName`, `quantity`, `source`, etc. |
| Mark approved parts as ordered | `PATCH` | `/api/mobile/company/{companyId}/inspections/{inspectionId}/line-items` | Use `action=order_approved` plus optional `approvedNames` |

## Selectors

| Purpose | Method | Path |
| --- | --- | --- |
| Search products | `GET` | `/api/mobile/company/{companyId}/selectors/products?search=&type=` |
| Retrieve part type requirements | `GET` | `/api/mobile/company/{companyId}/selectors/parts` |
| Fetch tyre size options | `GET` | `/api/mobile/company/{companyId}/selectors/cars/tyre-sizes` |

## Customers

| Purpose | Method | Path |
| --- | --- | --- |
| Customer detail + wallet summary | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}` |
| Wallet summary | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}/wallet/summary` |
| Wallet transactions | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}/wallet/transactions` |
| Create wallet transaction | `POST` | `/api/mobile/company/{companyId}/customers/{customerId}/wallet/transactions` |
| List customer cars | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}/cars` |
| Link/ create a car | `POST` | `/api/mobile/company/{companyId}/customers/{customerId}/cars` |
| Update car link | `PATCH` | `/api/mobile/company/{companyId}/customers/{customerId}/cars?linkId=` |
| Unlink car | `DELETE` | `/api/mobile/company/{companyId}/customers/{customerId}/cars?linkId=` |
| Select car workflow | `POST` | `/api/mobile/company/{companyId}/customers/{customerId}/cars/select` |
| Customer leads | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}/leads` |
| Customer inspections | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}/inspections` |
| Customer estimates | `GET` | `/api/mobile/company/{companyId}/customers/{customerId}/estimates` |

## Cars

| Purpose | Method | Path |
| --- | --- | --- |
| Car detail (with active customer links) | `GET` | `/api/mobile/company/{companyId}/cars/{carId}` |

## Leads

| Purpose | Method | Path |
| --- | --- | --- |
| Company leads list (filters: `q`, `status`, etc.) | `GET` | `/api/mobile/company/{companyId}/leads` |
| Car-in dashboard (leads, jobs, invoices, recovery, etc.) | `GET` | `/api/mobile/company/{companyId}/leads/car-in-dashboard` |
| Lead detail | `GET` | `/api/mobile/company/{companyId}/leads/{leadId}` |
| Update lead status/assignment | `PUT` | `/api/mobile/company/{companyId}/leads/{leadId}` |

