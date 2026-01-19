import { getSql } from "../db";
import type { PushDeviceTokenRow, UpsertPushDeviceTokenInput } from "./types";

const TABLE_NAME = "push_device_tokens";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function upsertPushDeviceToken(
  input: UpsertPushDeviceTokenInput
): Promise<PushDeviceTokenRow> {
  const sql: any = getSql();
  const result = await sql<PushDeviceTokenRow[]>`
    INSERT INTO ${sql(TABLE_NAME)} (
      scope,
      company_id,
      user_id,
      device_token,
      platform,
      device_id,
      is_active,
      last_seen_at
    ) VALUES (
      ${input.scope},
      ${input.scope === "global" ? null : input.companyId ?? null},
      ${input.userId ?? null},
      ${input.deviceToken},
      ${input.platform ?? null},
      ${input.deviceId ?? null},
      ${input.isActive ?? true},
      NOW()
    )
    ON CONFLICT (device_token) DO UPDATE
    SET
      scope = EXCLUDED.scope,
      company_id = EXCLUDED.company_id,
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      device_id = EXCLUDED.device_id,
      is_active = EXCLUDED.is_active,
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `;
  const rows = rowsFrom(result);
  return rows[0] as PushDeviceTokenRow;
}

export async function listActivePushTokensByScope(
  scope: "global" | "company",
  companyId?: string | null,
  userId?: string | null
): Promise<PushDeviceTokenRow[]> {
  const sql: any = getSql();
  const result = await sql<PushDeviceTokenRow[]>`
    SELECT *
    FROM ${sql(TABLE_NAME)}
    WHERE scope = ${scope}
      AND is_active = TRUE
      AND (${scope} = 'global' OR company_id = ${companyId ?? null})
      AND (${userId ?? null} IS NULL OR user_id = ${userId})
    ORDER BY last_seen_at DESC
  `;
  return rowsFrom(result) as PushDeviceTokenRow[];
}

export async function deactivatePushDeviceToken(
  deviceToken: string,
  userId?: string | null
): Promise<PushDeviceTokenRow | null> {
  const sql: any = getSql();
  const result = await sql<PushDeviceTokenRow[]>`
    UPDATE ${sql(TABLE_NAME)}
    SET is_active = FALSE, updated_at = NOW()
    WHERE device_token = ${deviceToken}
      AND (${userId ?? null} IS NULL OR user_id = ${userId})
    RETURNING *
  `;
  const rows = rowsFrom(result);
  return (rows[0] as PushDeviceTokenRow | undefined) ?? null;
}
