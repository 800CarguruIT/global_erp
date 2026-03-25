import type { EngineKey, EngineResult } from "./types";

interface CacheEntry {
  result: EngineResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function key(companyId: string, engineKey: EngineKey, branchId: string | null): string {
  return `${companyId}:${engineKey}:${branchId ?? "global"}`;
}

export function get(
  companyId: string,
  engineKey: EngineKey,
  branchId: string | null
): EngineResult | null {
  const entry = cache.get(key(companyId, engineKey, branchId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key(companyId, engineKey, branchId));
    return null;
  }
  return entry.result;
}

export function set(
  companyId: string,
  engineKey: EngineKey,
  branchId: string | null,
  result: EngineResult,
  ttlMinutes: number
): void {
  cache.set(key(companyId, engineKey, branchId), {
    result,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  });
}

export function invalidate(companyId: string, engineKey?: EngineKey): void {
  for (const k of Array.from(cache.keys())) {
    if (engineKey) {
      if (k.startsWith(`${companyId}:${engineKey}:`)) cache.delete(k);
    } else {
      if (k.startsWith(`${companyId}:`)) cache.delete(k);
    }
  }
}
