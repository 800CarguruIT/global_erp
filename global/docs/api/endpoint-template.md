# <Endpoint Name>

Owner:  
Last Updated:  
Status: draft

## Summary

Short purpose of this endpoint.

## Contract

- Method: `GET|POST|PUT|PATCH|DELETE`
- URL: `/api/...`
- Auth: `public|authenticated|role-based`

## Request

### Headers

- `Authorization: Bearer <token>` (if required)
- `Content-Type: application/json`

### Body

```json
{}
```

## Response

### Success

```json
{}
```

### Errors

- `400` Validation error
- `401` Unauthorized
- `403` Forbidden
- `404` Not found
- `500` Server error
