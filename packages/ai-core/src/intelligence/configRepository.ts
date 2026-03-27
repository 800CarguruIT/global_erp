import { getSql } from "../db";
import type { EngineKey, EngineConfig } from "./types";
import { ALL_ENGINE_KEYS } from "./types";

export async function getEngineConfig(
  companyId: string,
  engineKey: EngineKey
): Promise<EngineConfig | null> {
  const sql = getSql();
  const rows = await sql<EngineConfig[]>`
    SELECT
      engine_key,
      enabled,
      refresh_interval_min,
      thresholds,
      prompt_override
    FROM ai_intelligence_config
    WHERE company_id = ${companyId} AND engine_key = ${engineKey}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getAllEngineConfigs(companyId: string): Promise<EngineConfig[]> {
  const sql = getSql();
  const rows = await sql<EngineConfig[]>`
    SELECT engine_key, enabled, refresh_interval_min, thresholds, prompt_override
    FROM ai_intelligence_config
    WHERE company_id = ${companyId}
    ORDER BY engine_key
  `;

  // Fill in defaults for any engines not yet configured
  const existing = new Map(rows.map((r) => [r.engine_key, r]));
  return ALL_ENGINE_KEYS.map(
    (key) =>
      existing.get(key) ?? {
        engine_key: key,
        enabled: true,
        refresh_interval_min: 5,
        thresholds: {},
        prompt_override: null,
      }
  );
}

export async function upsertEngineConfig(
  companyId: string,
  engineKey: EngineKey,
  patch: Partial<Omit<EngineConfig, "engine_key">>
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO ai_intelligence_config (company_id, engine_key, enabled, refresh_interval_min, thresholds, prompt_override, updated_at)
    VALUES (
      ${companyId},
      ${engineKey},
      ${patch.enabled ?? true},
      ${patch.refresh_interval_min ?? 5},
      ${sql.json((patch.thresholds ?? {}) as any)},
      ${patch.prompt_override ?? null},
      now()
    )
    ON CONFLICT (company_id, engine_key) DO UPDATE SET
      enabled               = COALESCE(EXCLUDED.enabled, ai_intelligence_config.enabled),
      refresh_interval_min  = COALESCE(EXCLUDED.refresh_interval_min, ai_intelligence_config.refresh_interval_min),
      thresholds            = COALESCE(EXCLUDED.thresholds, ai_intelligence_config.thresholds),
      prompt_override       = EXCLUDED.prompt_override,
      updated_at            = now()
  `;
}
