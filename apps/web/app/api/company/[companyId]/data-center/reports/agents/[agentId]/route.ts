import { NextRequest, NextResponse } from "next/server";
import { CustomerDataCenter } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string; agentId: string }> };
type Segment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSegment(value: string | null | undefined): Segment | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "chsc") return "chsc";
  if (v === "non_chsc" || v === "non-chsc") return "non_chsc";
  if (v === "insurance") return "insurance";
  if (v === "warranty" || v === "battery-warranty") return "warranty";
  if (v === "unknown") return "unknown";
  return undefined;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, agentId } = await ctx.params;
  let access: Awaited<ReturnType<typeof resolveDataCenterAccess>>;
  try {
    access = await resolveDataCenterAccess(userId, companyId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (access.scope === "agent" && access.agentUserId !== agentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const to = parseDate(url.searchParams.get("to")) ?? new Date();
  const from = parseDate(url.searchParams.get("from")) ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const segment = normalizeSegment(url.searchParams.get("segment"));
  const supervisorUserIdRaw = url.searchParams.get("supervisorUserId");
  const supervisorUserId =
    access.scope === "supervisor" ? access.supervisorUserId : supervisorUserIdRaw || undefined;

  try {
    const [kpis, report] = await Promise.all([
      CustomerDataCenter.getKpis({
        companyId,
        from,
        to,
        segment,
        supervisorUserId: supervisorUserId || undefined,
        agentUserId: agentId,
      }),
      CustomerDataCenter.getAgentsReport({
        companyId,
        from,
        to,
        segment,
        supervisorUserId: supervisorUserId || undefined,
        agentUserId: agentId,
      }),
    ]);

    return NextResponse.json({
      data: {
        kpis,
        row: report.rows[0] ?? null,
        period: { from: report.from, to: report.to },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("from must be before to")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("GET /api/company/[companyId]/data-center/reports/agents/[agentId] error:", error);
    return NextResponse.json({ error: "Failed to load agent performance" }, { status: 500 });
  }
}
