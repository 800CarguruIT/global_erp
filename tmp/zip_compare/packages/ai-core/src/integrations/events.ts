import { getSql } from "../db";

export type IntegrationEventDirection = "outbound" | "inbound";
export type IntegrationEventStatus = "queued" | "success" | "failed";

export interface CreateIntegrationEventInput {
  integrationType: "dialer" | "channel";
  integrationId: string;
  providerKey: string;
  direction: IntegrationEventDirection;
  eventType: string;
  payload: unknown;
  status?: IntegrationEventStatus;
  error?: string | null;
}

export interface IntegrationEventRow {
  id: string;
  integrationType: "dialer" | "channel";
  integrationId: string;
  providerKey: string;
  direction: IntegrationEventDirection;
  eventType: string;
  payload: unknown;
  status: IntegrationEventStatus;
  error: string | null;
  createdAt: Date | string;
}

const TABLE = "integration_events";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function createIntegrationEvent(
  input: CreateIntegrationEventInput
): Promise<IntegrationEventRow> {
  const sql: any = getSql();
  const result = await sql`
    INSERT INTO ${sql(TABLE)} (
      integration_type,
      integration_id,
      provider_key,
      direction,
      event_type,
      payload,
      status,
      error
    )
    VALUES (
      ${input.integrationType},
      ${input.integrationId},
      ${input.providerKey},
      ${input.direction},
      ${input.eventType},
      ${input.payload},
      ${input.status ?? "queued"},
      ${input.error ?? null}
    )
    RETURNING
      id,
      integration_type,
      integration_id,
      provider_key,
      direction,
      event_type,
      payload,
      status,
      error,
      created_at
  `;

  const row = rowsFrom<any>(result)[0];
  return {
    id: row.id,
    integrationType: row.integration_type,
    integrationId: row.integration_id,
    providerKey: row.provider_key,
    direction: row.direction,
    eventType: row.event_type,
    payload: row.payload,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function markIntegrationEventStatus(
  id: string,
  status: IntegrationEventStatus,
  error?: string | null,
  payload?: unknown
): Promise<void> {
  const sql: any = getSql();
  if (payload === undefined) {
    await sql`
      UPDATE ${sql(TABLE)}
      SET
        status = ${status},
        error = ${error ?? null}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE ${sql(TABLE)}
      SET
        status = ${status},
        error = ${error ?? null},
        payload = ${payload}
      WHERE id = ${id}
    `;
  }
}

export async function listIntegrationEvents(
  integrationType: "dialer" | "channel",
  integrationId: string,
  limit = 20
): Promise<IntegrationEventRow[]> {
  const sql: any = getSql();
  const result = await sql`
    SELECT
      id,
      integration_type,
      integration_id,
      provider_key,
      direction,
      event_type,
      payload,
      status,
      error,
      created_at
    FROM ${sql(TABLE)}
    WHERE integration_type = ${integrationType}
      AND integration_id = ${integrationId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rowsFrom<any>(result).map((row) => ({
    id: row.id,
    integrationType: row.integration_type,
    integrationId: row.integration_id,
    providerKey: row.provider_key,
    direction: row.direction,
    eventType: row.event_type,
    payload: row.payload,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  }));
}
