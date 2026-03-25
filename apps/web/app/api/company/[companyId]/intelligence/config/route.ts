import { NextRequest, NextResponse } from "next/server";
import { Users, Intelligence } from "@repo/ai-core";
import type { EngineKey } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

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
    // allow
  }

  try {
    const [engines, recentLogs] = await Promise.all([
      Intelligence.getAllEngineConfigs(companyId),
      Intelligence.getRecentLogs(companyId, 10),
    ]);
    return NextResponse.json({
      engines: engines.map((e) => ({
        ...e,
        has_prompt_override: !!e.prompt_override,
        prompt_override: e.prompt_override, // include for edit UI
      })),
      recent_logs: recentLogs,
    });
  } catch (err: any) {
    console.error("GET /intelligence/config error:", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: ParamsCtx) {
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
    // allow
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const engineKey = body.engine_key as EngineKey;
  const valid: EngineKey[] = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"];
  if (!valid.includes(engineKey)) {
    return NextResponse.json({ error: "Invalid engine_key" }, { status: 400 });
  }

  try {
    await Intelligence.upsertEngineConfig(companyId, engineKey, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      refresh_interval_min: typeof body.refresh_interval_min === "number" ? body.refresh_interval_min : undefined,
      thresholds: typeof body.thresholds === "object" ? body.thresholds : undefined,
      prompt_override: typeof body.prompt_override === "string" ? body.prompt_override || null : undefined,
    });
    // Invalidate cache for this engine
    Intelligence.invalidateCache(companyId, engineKey);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH /intelligence/config error:", err);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
