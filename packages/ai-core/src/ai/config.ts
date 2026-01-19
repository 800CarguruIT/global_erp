// packages/ai-core/src/config.ts
import { getSql } from "../db";

export type AiModuleConfig = {
  key: string;
  label: string;
  category: string;
  description: string | null;
  global_enabled: boolean;
};

export type AiGlobalConfig = {
  master_enabled: boolean;
  modules: AiModuleConfig[];
};

export async function fetchAiGlobalConfig(): Promise<AiGlobalConfig> {
  const sql = getSql();

  const [globalRow] = await sql<{ master_enabled: boolean }[]>`
    SELECT master_enabled
    FROM ai_global_config
    ORDER BY id
    LIMIT 1
  `;

  const modules = await sql<AiModuleConfig[]>`
    SELECT key, label, category, description, global_enabled
    FROM ai_modules
    ORDER BY category, key
  `;

  return {
    master_enabled: globalRow?.master_enabled ?? true,
    modules,
  };
}

export async function updateAiMasterEnabled(enabled: boolean): Promise<void> {
  const sql = getSql();

  // update the single row
  await sql`
    UPDATE ai_global_config
    SET master_enabled = ${enabled}, updated_at = now()
    WHERE id = (
      SELECT id FROM ai_global_config
      ORDER BY id
      LIMIT 1
    )
  `;
}

export async function updateAiModuleEnabled(
  key: string,
  enabled: boolean
): Promise<void> {
  const sql = getSql();

  await sql`
    UPDATE ai_modules
    SET global_enabled = ${enabled}, updated_at = now()
    WHERE key = ${key}
  `;
}
