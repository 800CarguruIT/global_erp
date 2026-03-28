import * as signalCache from "./signalCache";
import * as configRepo from "./configRepository";
import * as signalLog from "./signalLogRepository";
import { runEngine } from "./aiService";
import { serialize as e1 } from "./serializers/e1FunnelSerializer";
import { serialize as e2 } from "./serializers/e2AgentSerializer";
import { serialize as e3 } from "./serializers/e3RevenueSerializer";
import { serialize as e4 } from "./serializers/e4ChurnSerializer";
import { serialize as e5 } from "./serializers/e5AnomalySerializer";
import { serialize as e6 } from "./serializers/e6CollectionsSerializer";
import { serialize as e7 } from "./serializers/e7CoachingSerializer";
import { serialize as e8 } from "./serializers/e8CallCenterSerializer";
import type { EngineKey, EngineResult, RunIntelligenceParams } from "./types";

const SERIALIZERS: Record<EngineKey, typeof e1> = { e1, e2, e3, e4, e5, e6, e7, e8 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runIntelligence(params: RunIntelligenceParams): Promise<EngineResult[]> {
  const { companyId, branchId, engineKeys, from, to } = params;
  const results: EngineResult[] = [];

  for (let i = 0; i < engineKeys.length; i++) {
    const engineKey = engineKeys[i] as EngineKey;

    // 1. Cache hit
    const cached = signalCache.get(companyId, engineKey, branchId);
    if (cached) {
      results.push({ ...cached, cached: true });
      continue;
    }

    // 2. Check enabled
    let config = null;
    try {
      config = await configRepo.getEngineConfig(companyId, engineKey);
    } catch {
      // config table may not exist in fresh deploy — treat as enabled
    }
    if (config && !config.enabled) continue;

    // 3. Run serializer + AI
    try {
      const serializer = SERIALIZERS[engineKey];
      const payload = await serializer(companyId, branchId, from, to);
      const thresholds = config?.thresholds ?? {};

      const { signals, tokensUsed, latencyMs } = await runEngine({
        companyId,
        engineKey,
        payload,
        thresholds,
      });

      const result: EngineResult = {
        engine_key: engineKey,
        signals,
        cached: false,
        generated_at: new Date().toISOString(),
        error: null,
      };

      const ttl = config?.refresh_interval_min ?? 5;
      signalCache.set(companyId, engineKey, branchId, result, ttl);

      // Fire-and-forget log (don't await to avoid blocking response)
      signalLog
        .logSignalRun({
          companyId,
          branchId,
          engineKey,
          signals,
          tokensUsed,
          latencyMs,
          payloadSummary: { window_days: (payload as any).window_days ?? null, total: (payload as any).total_leads ?? (payload as any).total_window_revenue ?? null },
        })
        .catch(() => {});

      results.push(result);
    } catch (err: any) {
      const errorMsg = err?.message ?? "Unknown error";

      signalLog
        .logSignalError({ companyId, branchId, engineKey, error: errorMsg })
        .catch(() => {});

      results.push({
        engine_key: engineKey,
        signals: [],
        cached: false,
        generated_at: new Date().toISOString(),
        error: errorMsg,
      });
    }

    // 4. Stagger: 500ms between engine calls (skip after last)
    if (i < engineKeys.length - 1) {
      await sleep(500);
    }
  }

  return results;
}
