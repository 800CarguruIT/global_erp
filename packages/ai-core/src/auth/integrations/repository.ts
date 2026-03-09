import { getSql } from "../../db";
import type { IntegrationApiClientRow } from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getActiveIntegrationClientByClientId(
  clientId: string
): Promise<IntegrationApiClientRow | null> {
  const sql = getSql();
  const rows = await sql<IntegrationApiClientRow[]>`
    SELECT
      id,
      client_id,
      client_name,
      client_secret_hash,
      company_id,
      scopes,
      is_active,
      last_used_at,
      created_at,
      updated_at
    FROM integration_api_clients
    WHERE client_id = ${clientId}
      AND is_active = TRUE
    LIMIT 1
  `;
  return rowsFrom(rows)[0] ?? null;
}

export async function touchIntegrationClientLastUsed(clientId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE integration_api_clients
    SET
      last_used_at = now(),
      updated_at = now()
    WHERE client_id = ${clientId}
  `;
}
