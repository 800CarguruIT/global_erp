# Integration Auth API

This is the first step for separating Workshop Portal into a standalone app.

## Endpoint

- `POST /api/v1/workshops/auth/token`
- Legacy alias (kept for compatibility): `POST /api/integrations/auth/token`
- Grant type: `client_credentials`
- Response: JWT bearer access token

## Request

You can send credentials in either style:

1. `Authorization: Basic base64(client_id:client_secret)`
2. Request body fields `client_id` and `client_secret`

Accepted body formats:

- `application/x-www-form-urlencoded`
- `application/json`

Required fields:

- `grant_type=client_credentials`
- `client_id` (if not using Basic auth)
- `client_secret` (if not using Basic auth)

Optional:

- `scope` as space-separated values

## Response

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "workorder:read workorder:write",
  "company_id": "uuid-or-null"
}
```

## JWT Claims

- `iss`: integration issuer
- `aud`: API audience
- `sub`: `client:<client_id>`
- `client_id`
- `company_id`
- `scope` (space-separated scopes)
- `typ`: `integration_access`
- `iat`, `exp`, `jti`

## Bootstrap Configuration (No DB Row Yet)

Set `INTEGRATION_API_CLIENTS_JSON` in environment:

```json
[
  {
    "clientId": "workshops-app",
    "clientSecret": "replace-with-strong-secret",
    "companyId": "00000000-0000-0000-0000-000000000000",
    "scopes": ["workorder:read", "workorder:write", "invoice:read"],
    "isActive": true
  }
]
```

This fallback is used if `integration_api_clients` table is missing or no matching DB client exists.

## DB-backed Clients

Apply migration:

- `147_integration_api_clients.sql`

Store client secrets as scrypt hashes with format:

- `scrypt:v1:<salt_base64>:<digest_base64>`

Use `createIntegrationClientSecretHash()` from `@repo/ai-core` `IntegrationAuth` service when creating clients from admin tools/scripts.

## Example cURL

```bash
curl -X POST "http://localhost:3000/api/v1/workshops/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=workshops-app" \
  --data-urlencode "client_secret=replace-with-strong-secret" \
  --data-urlencode "scope=workshops:read workshops:write"
```

Use the returned token:

```bash
curl "http://localhost:3000/api/v1/workshops/work-orders?companyId=<companyId>" \
  -H "Authorization: Bearer <access_token>"
```

## Workshops API Base (`v1`)

All separated workshop APIs now live under:

- `/api/v1/workshops/...`

Auth and tenant resolution:

- Bearer token is required on all protected endpoints.
- `company_id` can come from JWT claim.
- If missing in JWT claim, pass `x-company-id` header or `companyId` query.

Scopes:

- Read endpoints: `workshops:read` (or `workshop:read`, `*`)
- Write endpoints: `workshops:write` (or `workshop:write`, `*`)

Current endpoints:

- `GET /api/v1/workshops`
- `GET|POST /api/v1/workshops/work-orders`
- `GET|PATCH /api/v1/workshops/work-orders/{workOrderId}`
- `GET|POST /api/v1/workshops/inspections`
- `GET|PATCH /api/v1/workshops/inspections/{inspectionId}`
- `GET|POST /api/v1/workshops/invoices`
- `GET|PATCH /api/v1/workshops/invoices/{invoiceId}`
