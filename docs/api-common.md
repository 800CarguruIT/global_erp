# API Common

## Version

- Version: v1
- Last updated: 2026-02-23
- Scope: App API + Mobile API

## Authentication Model

- App API: session/cookie or bearer token based on web auth.
- Mobile API: bearer access token from `/api/mobile/auth/login`.
- Unauthorized responses should return `401`.

## Scopes and Access

- Global scope: cross-company administration.
- Company scope: company-level operations.
- Branch scope: branch execution operations.
- Vendor scope: vendor portal operations.

Always validate the user is allowed for requested scope and company/branch/vendor context.

## Standard Headers

| Header | Type | Required | Nullable | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| Authorization | string | Required | No | None | `Bearer <token>` or valid session auth. |
| Content-Type | string | Conditional | No | `application/json` | Required for POST/PUT/PATCH body requests. |

## Pagination Standard

| Query Field | Type | Required | Nullable | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| limit | number | Optional | No | 20 | Typical max 100. |
| offset | number | Optional | No | 0 | Zero-based offset. |

Typical paginated response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "meta": {
      "total": 0,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

## Filtering and Search

| Query Field | Type | Required | Nullable | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| q | string | Optional | Yes | null | Free-text search. |
| status | string | Optional | Yes | null | Module status filter. |
| dateFrom | string (ISO date) | Optional | Yes | null | Start date filter. |
| dateTo | string (ISO date) | Optional | Yes | null | End date filter. |

## Sorting

If endpoint supports sort, use:

- `sortBy`: field name
- `sortDir`: `asc` or `desc`

If not implemented on endpoint, results are returned with backend default ordering.

## Idempotency and Safety

- GET requests are read-only.
- POST requests create resources and are not idempotent unless specified.
- Use server-side validation and duplicate prevention for critical writes.
