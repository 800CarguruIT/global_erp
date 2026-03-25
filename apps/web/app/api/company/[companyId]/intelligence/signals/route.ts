import { NextRequest, NextResponse } from "next/server";
import { Users, Intelligence } from "@repo/ai-core";
import type { EngineKey } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseEngineKeys(raw: string | null): EngineKey[] {
  if (!raw) return [...Intelligence.ALL_ENGINE_KEYS];
  const parts = raw.split(",").map((s) => s.trim()) as EngineKey[];
  const valid: EngineKey[] = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"];
  return parts.filter((k): k is EngineKey => valid.includes(k));
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;

  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employee } = await Users.getUserWithEmployee(userId);
    if (employee && employee.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    // allow — could be global admin
  }

  const url = new URL(req.url);
  const engineKeys = parseEngineKeys(url.searchParams.get("engines"));
  const branchId = url.searchParams.get("branchId") || null;

  const to = parseDate(url.searchParams.get("to")) ?? new Date();
  const from = parseDate(url.searchParams.get("from")) ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (!engineKeys.length) {
    return NextResponse.json({ engines: [] });
  }

  try {
    const engines = await Intelligence.runIntelligence({ companyId, branchId, engineKeys, from, to });
    return NextResponse.json({ engines });
  } catch (err: any) {
    console.error("GET /intelligence/signals error:", err);
    // Return empty engines — never break the caller
    return NextResponse.json({ engines: [] });
  }
}
