import { getSql } from "../db";
import type {
  ChannelIntegrationRow,
  SaveChannelIntegrationInput,
} from "./types";

const TABLE_NAME = "integration_channels";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getChannelIntegrationById(
  id: string
): Promise<ChannelIntegrationRow | null> {
  const sql: any = getSql();
  const result = await sql<ChannelIntegrationRow[]>`
    SELECT
      id,
      scope,
      company_id,
      name,
      channel_type,
      provider_key,
      auth_type,
      credentials,
      metadata,
      webhooks,
      is_active,
      created_at,
      updated_at
    FROM ${sql(TABLE_NAME)}
    WHERE id = ${id}
    LIMIT 1
  `;
  const rows = rowsFrom(result);
  return (rows[0] as ChannelIntegrationRow | undefined) ?? null;
}

export async function listChannelIntegrationsByScope(
  scope: "global" | "company",
  companyId?: string
): Promise<ChannelIntegrationRow[]> {
  const sql: any = getSql();
  const result =
    scope === "global"
      ? await sql<ChannelIntegrationRow[]>`
          SELECT *
          FROM ${sql(TABLE_NAME)}
          WHERE scope = 'global'
          ORDER BY created_at
        `
      : await sql<ChannelIntegrationRow[]>`
          SELECT *
          FROM ${sql(TABLE_NAME)}
          WHERE scope = 'company'
            AND company_id = ${companyId ?? null}
          ORDER BY created_at
        `;

  return rowsFrom(result) as ChannelIntegrationRow[];
}

export async function insertChannelIntegration(
  input: SaveChannelIntegrationInput
): Promise<ChannelIntegrationRow> {
  const sql: any = getSql();
  const result = await sql<ChannelIntegrationRow[]>`
    INSERT INTO ${sql(TABLE_NAME)} (
      scope,
      company_id,
      name,
      channel_type,
      provider_key,
      auth_type,
      credentials,
      metadata,
      webhooks,
      is_active
    ) VALUES (
      ${input.scope},
      ${input.scope === "global" ? null : input.companyId ?? null},
      ${input.name},
      ${input.channelType},
      ${input.providerKey},
      ${input.authType},
      ${input.credentials},
      ${input.metadata ?? {}},
      ${input.webhooks ?? {}},
      ${!!input.isActive}
    )
    RETURNING *
  `;
  const rows = rowsFrom(result);
  return rows[0] as ChannelIntegrationRow;
}

export async function updateChannelIntegration(
  id: string,
  input: SaveChannelIntegrationInput
): Promise<ChannelIntegrationRow> {
  const sql: any = getSql();
  const result = await sql<ChannelIntegrationRow[]>`
    UPDATE ${sql(TABLE_NAME)}
    SET
      scope = ${input.scope},
      company_id = ${input.scope === "global" ? null : input.companyId ?? null},
      name = ${input.name},
      channel_type = ${input.channelType},
      provider_key = ${input.providerKey},
      auth_type = ${input.authType},
      credentials = ${input.credentials},
      metadata = ${input.metadata ?? {}},
      webhooks = ${input.webhooks ?? {}},
      is_active = ${!!input.isActive},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const rows = rowsFrom(result);
  const row = rows[0] as ChannelIntegrationRow | undefined;
  if (!row) throw new Error(`Channel integration not found for id=${id}`);
  return row;
}

export async function softDeleteChannelIntegration(
  id: string
): Promise<ChannelIntegrationRow> {
  const sql: any = getSql();
  const result = await sql<ChannelIntegrationRow[]>`
    UPDATE ${sql(TABLE_NAME)}
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const rows = rowsFrom(result);
  const row = rows[0] as ChannelIntegrationRow | undefined;
  if (!row) throw new Error(`Channel integration not found for id=${id}`);
  return row;
}
