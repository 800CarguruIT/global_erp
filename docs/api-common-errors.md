# API Common Errors

## Version

- Version: v1
- Last updated: 2026-02-23

## Standard Error Codes

| Code | Name | Meaning | Typical Cause |
| --- | --- | --- | --- |
| 400 | Bad Request | Invalid payload or missing required fields | Missing `inspectionId`, malformed body, invalid enum |
| 401 | Unauthorized | Missing/invalid authentication | Missing token/session |
| 403 | Forbidden | Authenticated but no permission | Wrong scope or role |
| 404 | Not Found | Resource does not exist in scope | Unknown ID |
| 409 | Conflict | Request conflicts with existing state | Duplicate/active job card exists |
| 500 | Internal Server Error | Unhandled server failure | Unexpected runtime/DB issue |
| 503 | Service Unavailable | Backend dependency unavailable | Database unavailable |

## App API Error Shape (Typical)

```json
{
  "error": "Not found"
}
```

## Mobile API Error Shape (Standard)

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

## Validation Error Example

```json
{
  "error": "inspectionId required"
}
```

## Conflict Error Example

```json
{
  "error": "Job card already active"
}
```
