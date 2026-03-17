// packages/ai-core/src/policy.ts
import { getSql } from "../db";

export type AiFeatureKey =
  | "ai.master"
  | "ai.i18n"
  | "ai.whatsapp"
  | "ai.email"
  | "ai.sms"
  | "ai.calls"
  | "ai.b2b"
  | "ai.assistant";

export interface AiContext {
  platformId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  userRoles?: string[];
}

type ScopeRow = {
  scope_type: "global_all" | "platform" | "company";
  scope_id: string | null;
  enabled: boolean;
};

export async function canUseAi(
  feature: AiFeatureKey,
  ctx: AiContext
): Promise<boolean> {
  // 0) Hard env master kill (absolute override)
  const masterEnv = process.env.AI_MASTER_ENABLED;
  if (typeof masterEnv === "string") {
    const normalized = masterEnv.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false;
    }
  }

  const sql = getSql();

  // 1) Global config master_enabled from DB
  const [globalConfig] = await sql<{
    master_enabled: boolean;
  }[]>`
    SELECT master_enabled
    FROM ai_global_config
    ORDER BY id
    LIMIT 1
  `;

  if (globalConfig && globalConfig.master_enabled === false) {
    return false;
  }

  // 2) Module-level global_enabled (per feature)
  const [moduleRow] = await sql<{
    global_enabled: boolean;
  }[]>`
    SELECT global_enabled
    FROM ai_modules
    WHERE key = ${feature}
    LIMIT 1
  `;

  if (moduleRow && moduleRow.global_enabled === false) {
    return false;
  }

  // 3) Scope-based overrides: company > platform > global_all
  const platformId = ctx.platformId ?? null;
  const companyId = ctx.companyId ?? null;

  try {
    const scopeRows = await sql<ScopeRow[]>`
      SELECT scope_type, scope_id, enabled
      FROM ai_feature_toggles
      WHERE feature_key = ${feature}
        AND (
               scope_type = 'global_all'
            OR (scope_type = 'platform' AND scope_id = ${platformId})
            OR (scope_type = 'company'  AND scope_id = ${companyId})
        )
      ORDER BY
        CASE scope_type
          WHEN 'company'  THEN 3
          WHEN 'platform' THEN 2
          WHEN 'global_all' THEN 1
        END DESC
    `;

    if (scopeRows.length > 0) {
      // Take the highest-priority match
      const topRow = scopeRows[0];
      if (topRow) {
        return topRow.enabled;
      }
    }
  } catch (err) {
    // Missing table or other toggle error: allow by default but keep a lightweight log
    console.warn("AI toggle lookup skipped; default allow.", err);
  }

  // 4) Default: allowed
  return true;
}
