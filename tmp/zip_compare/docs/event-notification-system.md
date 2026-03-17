# Event Notification System (Email, SMS, WhatsApp)

## What this adds

- Rule-based event automation per company (`notification_event_rules`)
- Reliable outbox queue with retries and idempotency (`notification_event_outbox`)
- Delivery tracking per rule (`notification_event_deliveries`)
- Worker support (`pnpm --filter @repo/ai-core run events:worker`)
- Example domain event publisher in CRM lead creation (`lead.created`)

## High-performance design choices

- Outbox pattern: event creation is a single DB write in request path.
- `FOR UPDATE SKIP LOCKED`: safe parallel workers without duplicate claiming.
- Partial indexes on pending/retry rows for fast polling.
- Dedupe key unique index to prevent duplicate event enqueue.
- Retry with exponential backoff + jitter to reduce thundering herd.
- Delivery upsert per `(outbox_event_id, rule_id)` for idempotent reprocessing.

## API endpoints

- `GET /api/company/:companyId/events/notifications/rules`
- `POST /api/company/:companyId/events/notifications/rules`
- `PATCH /api/company/:companyId/events/notifications/rules/:ruleId`
- `DELETE /api/company/:companyId/events/notifications/rules/:ruleId` (soft delete)
- `POST /api/company/:companyId/events/notifications/publish`
- `POST /api/company/:companyId/events/notifications/process`

## Example rule

```json
{
  "name": "Lead Created WhatsApp",
  "eventKey": "lead.created",
  "channelType": "whatsapp",
  "recipientPath": "customer.whatsappPhone",
  "bodyTemplate": "Hi {{customer.name}}, your lead {{lead.id}} is created.",
  "priority": 10
}
```

## Template variables

Use `{{path.to.value}}` against event payload.

Example payload keys for `lead.created`:

- `lead.id`, `lead.type`, `lead.source`
- `customer.name`, `customer.phone`, `customer.email`, `customer.whatsappPhone`
- `company.id`
- `actor.userId`

## Run order (recommended)

1. Run migrations.
2. Ensure active company integrations exist for `email`, `sms`, and/or `whatsapp`.
3. Create notification rules.
4. Start worker process.
5. Publish test events and verify delivery logs.

## Operational tuning

- Worker env:
  - `NOTIFICATION_WORKER_POLL_MS` (default `2000`)
  - `NOTIFICATION_WORKER_BATCH_SIZE` (default `100`)
  - `NOTIFICATION_WORKER_BASE_BACKOFF_MS` (default `5000`)
- For high volume, run multiple worker replicas.
- Keep rule templates short and avoid oversized payloads.
- Use `dedupeKey` on all business events with natural uniqueness.
