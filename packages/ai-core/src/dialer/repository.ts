import { getSql } from "../db";
import type { DialerIntegration, DialerWebhook, SaveDialerInput } from "./types";

const TABLE_NAME = "integration_dialers";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getById(id: string): Promise<DialerIntegration | null> {
  const sql = getSql();
  const result = await sql<DialerIntegration[]>`
    SELECT id, provider, label, auth_type, credentials, is_global, company_id, is_active, created_at, updated_at
    FROM ${sql(TABLE_NAME)}
    WHERE id = ${id}
    LIMIT 1
  `;
  const rows = rowsFrom(result);
  return (rows[0] as DialerIntegration | undefined) ?? null;
}

export async function listGlobal(): Promise<DialerIntegration[]> {
  const sql = getSql();
  const result = await sql<DialerIntegration[]>`
    SELECT id, provider, label, auth_type, credentials, is_global, company_id, is_active, created_at, updated_at
    FROM ${sql(TABLE_NAME)}
    WHERE is_global = TRUE
    ORDER BY created_at
  `;
  return rowsFrom(result);
}

export async function listForCompany(companyId: string): Promise<DialerIntegration[]> {
  const sql = getSql();
  const result = await sql<DialerIntegration[]>`
    SELECT id, provider, label, auth_type, credentials, is_global, company_id, is_active, created_at, updated_at
    FROM ${sql(TABLE_NAME)}
    WHERE company_id = ${companyId}
    ORDER BY created_at
  `;
  return rowsFrom(result);
}

export async function insert(input: SaveDialerInput): Promise<DialerIntegration> {
  const sql = getSql();
  const result = await sql<DialerIntegration[]>`
    INSERT INTO ${sql(TABLE_NAME)} (
      provider,
      label,
      auth_type,
      credentials,
      is_global,
      company_id,
      is_active
    )
    VALUES (
      ${input.provider},
      ${input.label},
      ${input.authType},
      ${input.credentials},
      ${input.isGlobal},
      ${input.companyId},
      ${!!input.isActive}
    )
    RETURNING id, provider, label, auth_type, credentials, is_global, company_id, is_active, created_at, updated_at
  `;
  const rows = rowsFrom(result);
  const dialer = rows[0] as DialerIntegration | undefined;
  if (!dialer) {
    throw new Error("Failed to insert dialer integration");
  }

  if (input.metadata) await upsertDialerMetadata(dialer.id, input.metadata);
  if (input.webhooks) await replaceDialerWebhooks(dialer.id, input.webhooks);

  return dialer;
}

export async function update(input: SaveDialerInput): Promise<DialerIntegration> {
  if (!input.id) throw new Error("update() requires input.id");

  const sql = getSql();
  const result = await sql<DialerIntegration[]>`
    UPDATE ${sql(TABLE_NAME)}
    SET
      provider   = ${input.provider},
      label      = ${input.label},
      auth_type  = ${input.authType},
      credentials = ${input.credentials},
      is_global  = ${input.isGlobal},
      company_id = ${input.companyId},
      is_active  = ${!!input.isActive},
      updated_at = NOW()
    WHERE id = ${input.id}
    RETURNING id, provider, label, auth_type, credentials, is_global, company_id, is_active, created_at, updated_at
  `;
  const rows = rowsFrom(result);
  const row = rows[0] as DialerIntegration | undefined;
  if (!row) throw new Error(`Dialer integration not found for id=${input.id}`);
  if (input.metadata) await upsertDialerMetadata(row.id, input.metadata);
  if (input.webhooks) await replaceDialerWebhooks(row.id, input.webhooks);
  return row;
}

// Optional metadata helpers (used by callers later)
export async function getDialerMetadata(dialerId: string): Promise<Record<string, string>> {
  const sql = getSql();
  const result = await sql<{ key: string; value: string }[]>`
    SELECT key, value
    FROM integration_dialer_metadata
    WHERE dialer_id = ${dialerId}
  `;
  const rows = rowsFrom(result);
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function getDialerWebhooks(dialerId: string): Promise<DialerWebhook[]> {
  const sql = getSql();
  const result = await sql<DialerWebhook[]>`
    SELECT id, dialer_id, event, url, secret, created_at
    FROM integration_dialer_webhooks
    WHERE dialer_id = ${dialerId}
  `;
  return rowsFrom(result);
}

export async function upsertDialerMetadata(
  dialerId: string,
  metadata: Record<string, string>
): Promise<void> {
  const sql = getSql();
  for (const [key, value] of Object.entries(metadata)) {
    await sql`
      INSERT INTO integration_dialer_metadata (dialer_id, key, value)
      VALUES (${dialerId}, ${key}, ${value})
      ON CONFLICT (dialer_id, key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
}

export async function replaceDialerWebhooks(
  dialerId: string,
  webhooks: Array<{ event: string; url: string; secret?: string }>
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM integration_dialer_webhooks
    WHERE dialer_id = ${dialerId}
  `;

  for (const wh of webhooks) {
    await sql`
      INSERT INTO integration_dialer_webhooks (dialer_id, event, url, secret)
      VALUES (${dialerId}, ${wh.event}, ${wh.url}, ${wh.secret ?? null})
    `;
  }
}
