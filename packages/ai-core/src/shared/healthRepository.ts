import { getSql } from "../db";
import type { IntegrationHealthStatus } from "../dialer/types";

export interface IntegrationHealthRow {
  integrationType: "dialer" | "channel";
  integrationId: string;
  providerKey: string;
  status: IntegrationHealthStatus;
  lastCheckedAt: Date;
  lastError?: string | null;
}

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

const TABLE = "integration_health";

export async function upsertIntegrationHealth(
  health: IntegrationHealthRow
): Promise<IntegrationHealthRow> {
  const sql = getSql();
  const result = await sql<{
    integration_type: "dialer" | "channel";
    integration_id: string;
    provider_key: string;
    status: IntegrationHealthStatus;
    last_checked_at: Date;
    last_error: string | null;
  }[]>`
    INSERT INTO ${sql(TABLE)} (
      integration_type,
      integration_id,
      provider_key,
      status,
      last_checked_at,
      last_error
    )
    VALUES (
      ${health.integrationType},
      ${health.integrationId},
      ${health.providerKey},
      ${health.status},
      ${health.lastCheckedAt},
      ${health.lastError ?? null}
    )
    ON CONFLICT (integration_type, integration_id)
    DO UPDATE SET
      provider_key = EXCLUDED.provider_key,
      status = EXCLUDED.status,
      last_checked_at = EXCLUDED.last_checked_at,
      last_error = EXCLUDED.last_error
    RETURNING integration_type, integration_id, provider_key, status, last_checked_at, last_error
  `;
  const row = rowsFrom(result)[0];
  if (!row) {
    throw new Error("Failed to upsert integration health");
  }
  return {
    integrationType: row.integration_type,
    integrationId: row.integration_id,
    providerKey: row.provider_key,
    status: row.status,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
  };
}

export async function getIntegrationHealthForIds(
  integrationType: "dialer" | "channel",
  integrationIds: string[]
): Promise<IntegrationHealthRow[]> {
  if (!integrationIds.length) return [];
  const sql = getSql();
  const result = await sql<{
    integration_type: "dialer" | "channel";
    integration_id: string;
    provider_key: string;
    status: IntegrationHealthStatus;
    last_checked_at: Date;
    last_error: string | null;
  }[]>`
    SELECT integration_type, integration_id, provider_key, status, last_checked_at, last_error
    FROM ${sql(TABLE)}
    WHERE integration_type = ${integrationType}
      AND integration_id = ANY(${integrationIds})
  `;
  return rowsFrom(result).map((row) => ({
    integrationType: row.integration_type,
    integrationId: row.integration_id,
    providerKey: row.provider_key,
    status: row.status,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
  }));
}
