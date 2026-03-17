import { getSql } from "../db";
import { sendMessageWithIntegrationId } from "../channels/service";

export type NotificationChannelType = "email" | "sms" | "whatsapp";

type JsonObject = Record<string, unknown>;

export interface NotificationRule {
  id: string;
  companyId: string;
  name: string;
  eventKey: string;
  channelType: NotificationChannelType;
  integrationId: string | null;
  recipientPath: string;
  subjectTemplate: string | null;
  bodyTemplate: string;
  isActive: boolean;
  priority: number;
  metadata: JsonObject;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateNotificationRuleInput {
  companyId: string;
  name: string;
  eventKey: string;
  channelType: NotificationChannelType;
  integrationId?: string | null;
  recipientPath: string;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  isActive?: boolean;
  priority?: number;
  metadata?: JsonObject;
}

export interface UpdateNotificationRuleInput {
  id: string;
  companyId: string;
  name?: string;
  eventKey?: string;
  channelType?: NotificationChannelType;
  integrationId?: string | null;
  recipientPath?: string;
  subjectTemplate?: string | null;
  bodyTemplate?: string;
  isActive?: boolean;
  priority?: number;
  metadata?: JsonObject;
}

export interface PublishEventInput {
  companyId: string;
  eventKey: string;
  payload: JsonObject;
  dedupeKey?: string | null;
  maxAttempts?: number;
  nextAttemptAt?: Date;
}

export interface NotificationOutboxEvent {
  id: string;
  companyId: string;
  eventKey: string;
  payload: JsonObject;
  status: "pending" | "processing" | "retry" | "processed" | "failed";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date | string;
  lockedAt: Date | string | null;
  processedAt: Date | string | null;
  dedupeKey: string | null;
  lastError: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProcessOutboxBatchOptions {
  batchSize?: number;
  baseBackoffMs?: number;
  companyId?: string;
}

export interface ProcessOutboxBatchResult {
  claimed: number;
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
}

interface RuleDeliverySnapshot {
  status: "queued" | "success" | "failed" | "skipped";
  attemptCount: number;
}

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

function toRule(row: any): NotificationRule {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    eventKey: row.event_key,
    channelType: row.channel_type,
    integrationId: row.integration_id,
    recipientPath: row.recipient_path,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    isActive: row.is_active,
    priority: Number(row.priority ?? 100),
    metadata: (row.metadata ?? {}) as JsonObject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOutboxEvent(row: any): NotificationOutboxEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    eventKey: row.event_key,
    payload: (row.payload ?? {}) as JsonObject,
    status: row.status,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    nextAttemptAt: row.next_attempt_at,
    lockedAt: row.locked_at,
    processedAt: row.processed_at,
    dedupeKey: row.dedupe_key,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parsePath(path: string): string[] {
  return path
    .trim()
    .replace(/^\$\.?/, "")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
}

function getPathValue(obj: unknown, rawPath: string): unknown {
  if (!rawPath.trim()) return undefined;
  const parts = parsePath(rawPath);
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function coerceRecipient(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.trim().length > 0);
    return typeof first === "string" ? first.trim() : null;
  }
  return null;
}

function toRenderableString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function renderTemplate(template: string | null, payload: JsonObject): string | null {
  if (!template) return null;
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const value = getPathValue(payload, key);
    return toRenderableString(value);
  });
}

function nextAttemptDate(attemptCount: number, baseBackoffMs: number): Date {
  const factor = Math.min(2 ** Math.max(attemptCount - 1, 0), 32);
  const jitter = Math.floor(Math.random() * 500);
  return new Date(Date.now() + baseBackoffMs * factor + jitter);
}

function trimErrorMessage(input: unknown): string {
  const msg = typeof input === "string" ? input : (input as any)?.message;
  if (!msg) return "Unknown error";
  const str = String(msg);
  return str.length > 800 ? str.slice(0, 800) : str;
}

export async function listNotificationRules(companyId: string): Promise<NotificationRule[]> {
  const sql: any = getSql();
  const result = await sql`
    SELECT *
    FROM notification_event_rules
    WHERE company_id = ${companyId}
    ORDER BY is_active DESC, priority ASC, created_at DESC
  `;
  return rowsFrom<any>(result).map(toRule);
}

export async function createNotificationRule(
  input: CreateNotificationRuleInput
): Promise<NotificationRule> {
  const sql: any = getSql();
  const result = await sql`
    INSERT INTO notification_event_rules (
      company_id,
      name,
      event_key,
      channel_type,
      integration_id,
      recipient_path,
      subject_template,
      body_template,
      is_active,
      priority,
      metadata
    ) VALUES (
      ${input.companyId},
      ${input.name},
      ${input.eventKey},
      ${input.channelType},
      ${input.integrationId ?? null},
      ${input.recipientPath},
      ${input.subjectTemplate ?? null},
      ${input.bodyTemplate},
      ${input.isActive ?? true},
      ${input.priority ?? 100},
      ${input.metadata ?? {}}
    )
    RETURNING *
  `;
  const row = rowsFrom<any>(result)[0];
  return toRule(row);
}

export async function updateNotificationRule(
  input: UpdateNotificationRuleInput
): Promise<NotificationRule> {
  const sql: any = getSql();
  const result = await sql`
    UPDATE notification_event_rules
    SET
      name = COALESCE(${input.name ?? null}, name),
      event_key = COALESCE(${input.eventKey ?? null}, event_key),
      channel_type = COALESCE(${input.channelType ?? null}, channel_type),
      integration_id = CASE
        WHEN ${input.integrationId === undefined} THEN integration_id
        ELSE ${input.integrationId ?? null}
      END,
      recipient_path = COALESCE(${input.recipientPath ?? null}, recipient_path),
      subject_template = CASE
        WHEN ${input.subjectTemplate === undefined} THEN subject_template
        ELSE ${input.subjectTemplate ?? null}
      END,
      body_template = COALESCE(${input.bodyTemplate ?? null}, body_template),
      is_active = COALESCE(${input.isActive ?? null}, is_active),
      priority = COALESCE(${input.priority ?? null}, priority),
      metadata = COALESCE(${input.metadata ?? null}, metadata),
      updated_at = NOW()
    WHERE id = ${input.id}
      AND company_id = ${input.companyId}
    RETURNING *
  `;

  const row = rowsFrom<any>(result)[0];
  if (!row) {
    throw new Error("Notification rule not found");
  }
  return toRule(row);
}

export async function softDeleteNotificationRule(
  companyId: string,
  ruleId: string
): Promise<NotificationRule> {
  const sql: any = getSql();
  const result = await sql`
    UPDATE notification_event_rules
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE id = ${ruleId}
      AND company_id = ${companyId}
    RETURNING *
  `;

  const row = rowsFrom<any>(result)[0];
  if (!row) {
    throw new Error("Notification rule not found");
  }
  return toRule(row);
}

export async function publishNotificationEvent(
  input: PublishEventInput
): Promise<NotificationOutboxEvent> {
  const sql: any = getSql();
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 5, 20));

  if (input.dedupeKey && input.dedupeKey.trim()) {
    const result = await sql`
      INSERT INTO notification_event_outbox (
        company_id,
        event_key,
        payload,
        status,
        attempt_count,
        max_attempts,
        next_attempt_at,
        dedupe_key
      ) VALUES (
        ${input.companyId},
        ${input.eventKey},
        ${input.payload},
        ${"pending"},
        ${0},
        ${maxAttempts},
        ${input.nextAttemptAt ?? new Date()},
        ${input.dedupeKey.trim()}
      )
      ON CONFLICT (company_id, dedupe_key)
      WHERE dedupe_key IS NOT NULL
      DO UPDATE SET updated_at = NOW()
      RETURNING *
    `;
    return toOutboxEvent(rowsFrom<any>(result)[0]);
  }

  const result = await sql`
    INSERT INTO notification_event_outbox (
      company_id,
      event_key,
      payload,
      status,
      attempt_count,
      max_attempts,
      next_attempt_at,
      dedupe_key
    ) VALUES (
      ${input.companyId},
      ${input.eventKey},
      ${input.payload},
      ${"pending"},
      ${0},
      ${maxAttempts},
      ${input.nextAttemptAt ?? new Date()},
      ${null}
    )
    RETURNING *
  `;

  return toOutboxEvent(rowsFrom<any>(result)[0]);
}

async function claimOutboxBatch(
  batchSize: number,
  companyId?: string
): Promise<NotificationOutboxEvent[]> {
  const sql: any = getSql();
  const result = companyId
    ? await sql`
        WITH candidates AS (
          SELECT id
          FROM notification_event_outbox
          WHERE status IN ('pending', 'retry')
            AND next_attempt_at <= NOW()
            AND company_id = ${companyId}
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification_event_outbox o
        SET
          status = 'processing',
          locked_at = NOW(),
          updated_at = NOW()
        FROM candidates c
        WHERE o.id = c.id
        RETURNING o.*
      `
    : await sql`
        WITH candidates AS (
          SELECT id
          FROM notification_event_outbox
          WHERE status IN ('pending', 'retry')
            AND next_attempt_at <= NOW()
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification_event_outbox o
        SET
          status = 'processing',
          locked_at = NOW(),
          updated_at = NOW()
        FROM candidates c
        WHERE o.id = c.id
        RETURNING o.*
      `;

  return rowsFrom<any>(result).map(toOutboxEvent);
}

async function getActiveRules(companyId: string, eventKey: string): Promise<NotificationRule[]> {
  const sql: any = getSql();
  const result = await sql`
    SELECT *
    FROM notification_event_rules
    WHERE company_id = ${companyId}
      AND event_key = ${eventKey}
      AND is_active = TRUE
    ORDER BY priority ASC, created_at ASC
  `;
  return rowsFrom<any>(result).map(toRule);
}

async function getExistingDeliveries(
  outboxEventId: string
): Promise<Map<string, RuleDeliverySnapshot>> {
  const sql: any = getSql();
  const result = await sql`
    SELECT rule_id, status, attempt_count
    FROM notification_event_deliveries
    WHERE outbox_event_id = ${outboxEventId}
  `;

  const map = new Map<string, RuleDeliverySnapshot>();
  for (const row of rowsFrom<any>(result)) {
    map.set(row.rule_id, {
      status: row.status,
      attemptCount: Number(row.attempt_count ?? 0),
    });
  }
  return map;
}

async function getIntegrationsByIds(ids: string[]): Promise<Map<string, any>> {
  const sql: any = getSql();
  if (!ids.length) return new Map();
  const result = await sql`
    SELECT id, channel_type, is_active
    FROM integration_channels
    WHERE id IN ${sql(ids)}
  `;

  const map = new Map<string, any>();
  for (const row of rowsFrom<any>(result)) {
    map.set(row.id, row);
  }
  return map;
}

async function getDefaultIntegrationsByChannel(companyId: string): Promise<Map<string, string>> {
  const sql: any = getSql();
  const result = await sql`
    SELECT DISTINCT ON (channel_type)
      id,
      channel_type
    FROM integration_channels
    WHERE scope = 'company'
      AND company_id = ${companyId}
      AND is_active = TRUE
      AND channel_type IN ('email', 'sms', 'whatsapp')
    ORDER BY channel_type, created_at DESC
  `;

  const map = new Map<string, string>();
  for (const row of rowsFrom<any>(result)) {
    map.set(row.channel_type, row.id);
  }
  return map;
}

async function upsertDeliveryQueued(input: {
  outboxEventId: string;
  rule: NotificationRule;
  integrationId: string | null;
  recipient: string | null;
  subject: string | null;
  body: string;
}) {
  const sql: any = getSql();
  await sql`
    INSERT INTO notification_event_deliveries (
      outbox_event_id,
      rule_id,
      channel_type,
      integration_id,
      recipient,
      subject,
      body,
      status,
      attempt_count,
      updated_at
    ) VALUES (
      ${input.outboxEventId},
      ${input.rule.id},
      ${input.rule.channelType},
      ${input.integrationId},
      ${input.recipient},
      ${input.subject},
      ${input.body},
      ${"queued"},
      ${1},
      NOW()
    )
    ON CONFLICT (outbox_event_id, rule_id)
    DO UPDATE SET
      channel_type = EXCLUDED.channel_type,
      integration_id = EXCLUDED.integration_id,
      recipient = EXCLUDED.recipient,
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      status = 'queued',
      attempt_count = notification_event_deliveries.attempt_count + 1,
      updated_at = NOW()
  `;
}

async function updateDeliveryResult(input: {
  outboxEventId: string;
  ruleId: string;
  status: "success" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
  response?: unknown;
}) {
  const sql: any = getSql();
  await sql`
    UPDATE notification_event_deliveries
    SET
      status = ${input.status},
      provider_message_id = ${input.providerMessageId ?? null},
      error = ${input.error ?? null},
      response = ${input.response ?? null},
      updated_at = NOW()
    WHERE outbox_event_id = ${input.outboxEventId}
      AND rule_id = ${input.ruleId}
  `;
}

async function markOutboxProcessed(id: string) {
  const sql: any = getSql();
  await sql`
    UPDATE notification_event_outbox
    SET
      status = 'processed',
      processed_at = NOW(),
      locked_at = NULL,
      last_error = NULL,
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

async function markOutboxFailed(id: string, error: string) {
  const sql: any = getSql();
  await sql`
    UPDATE notification_event_outbox
    SET
      status = 'failed',
      processed_at = NOW(),
      locked_at = NULL,
      last_error = ${error},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

async function markOutboxRetry(id: string, attemptCount: number, error: string, nextAttemptAt: Date) {
  const sql: any = getSql();
  await sql`
    UPDATE notification_event_outbox
    SET
      status = 'retry',
      attempt_count = ${attemptCount},
      next_attempt_at = ${nextAttemptAt},
      locked_at = NULL,
      last_error = ${error},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

async function processOutboxEvent(
  event: NotificationOutboxEvent,
  baseBackoffMs: number
): Promise<"success" | "retry" | "failed"> {
  const rules = await getActiveRules(event.companyId, event.eventKey);
  if (!rules.length) {
    await markOutboxProcessed(event.id);
    return "success";
  }

  const existingDeliveries = await getExistingDeliveries(event.id);
  const integrationIds = rules
    .map((r) => r.integrationId)
    .filter((id): id is string => Boolean(id));
  const integrationsById = await getIntegrationsByIds(integrationIds);
  const defaultIntegrationByChannel = await getDefaultIntegrationsByChannel(event.companyId);

  const hardFailures: string[] = [];

  for (const rule of rules) {
    const existing = existingDeliveries.get(rule.id);
    if (existing?.status === "success") {
      continue;
    }

    const recipient = coerceRecipient(getPathValue(event.payload, rule.recipientPath));
    const subject = renderTemplate(rule.subjectTemplate, event.payload);
    const body = renderTemplate(rule.bodyTemplate, event.payload) || "";

    let integrationId = rule.integrationId;
    if (integrationId) {
      const integration = integrationsById.get(integrationId);
      if (!integration || !integration.is_active) {
        integrationId = null;
      }
    }
    if (!integrationId) {
      integrationId = defaultIntegrationByChannel.get(rule.channelType) ?? null;
    }

    await upsertDeliveryQueued({
      outboxEventId: event.id,
      rule,
      integrationId,
      recipient,
      subject,
      body,
    });

    if (!recipient) {
      const err = `Recipient path returned empty value: ${rule.recipientPath}`;
      hardFailures.push(err);
      await updateDeliveryResult({
        outboxEventId: event.id,
        ruleId: rule.id,
        status: "skipped",
        error: err,
      });
      continue;
    }

    if (!integrationId) {
      const err = `No active integration for channel ${rule.channelType}`;
      hardFailures.push(err);
      await updateDeliveryResult({
        outboxEventId: event.id,
        ruleId: rule.id,
        status: "failed",
        error: err,
      });
      continue;
    }

    try {
      const result = await sendMessageWithIntegrationId({
        scope: "company",
        companyId: event.companyId,
        integrationId,
        input: {
          to: recipient,
          subject,
          body,
          htmlBody: rule.channelType === "email" ? body : undefined,
          customPayload: {
            eventKey: event.eventKey,
            outboxEventId: event.id,
            ruleId: rule.id,
          },
        },
      });

      if (result.success) {
        await updateDeliveryResult({
          outboxEventId: event.id,
          ruleId: rule.id,
          status: "success",
          providerMessageId: result.messageId ?? null,
          response: result.providerResponse ?? result,
        });
      } else {
        const err = trimErrorMessage(result.error || "Channel provider returned failure");
        hardFailures.push(err);
        await updateDeliveryResult({
          outboxEventId: event.id,
          ruleId: rule.id,
          status: "failed",
          error: err,
          response: result.providerResponse ?? result,
        });
      }
    } catch (error: unknown) {
      const err = trimErrorMessage(error);
      hardFailures.push(err);
      await updateDeliveryResult({
        outboxEventId: event.id,
        ruleId: rule.id,
        status: "failed",
        error: err,
      });
    }
  }

  if (hardFailures.length === 0) {
    await markOutboxProcessed(event.id);
    return "success";
  }

  const nextAttemptCount = event.attemptCount + 1;
  if (nextAttemptCount >= event.maxAttempts) {
    await markOutboxFailed(event.id, hardFailures.join(" | ").slice(0, 800));
    return "failed";
  }

  const nextAttemptAt = nextAttemptDate(nextAttemptCount, baseBackoffMs);
  await markOutboxRetry(event.id, nextAttemptCount, hardFailures.join(" | ").slice(0, 800), nextAttemptAt);
  return "retry";
}

export async function processNotificationOutboxBatch(
  options: ProcessOutboxBatchOptions = {}
): Promise<ProcessOutboxBatchResult> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 100, 500));
  const baseBackoffMs = Math.max(1000, Math.min(options.baseBackoffMs ?? 5000, 60000));

  const claimed = await claimOutboxBatch(batchSize, options.companyId);

  const result: ProcessOutboxBatchResult = {
    claimed: claimed.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
  };

  for (const event of claimed) {
    try {
      const status = await processOutboxEvent(event, baseBackoffMs);
      result.processed += 1;
      if (status === "success") result.succeeded += 1;
      if (status === "retry") result.retried += 1;
      if (status === "failed") result.failed += 1;
    } catch (error: unknown) {
      const err = trimErrorMessage(error);
      const nextAttemptCount = event.attemptCount + 1;
      result.processed += 1;

      if (nextAttemptCount >= event.maxAttempts) {
        await markOutboxFailed(event.id, err);
        result.failed += 1;
      } else {
        await markOutboxRetry(event.id, nextAttemptCount, err, nextAttemptDate(nextAttemptCount, baseBackoffMs));
        result.retried += 1;
      }
    }
  }

  return result;
}
