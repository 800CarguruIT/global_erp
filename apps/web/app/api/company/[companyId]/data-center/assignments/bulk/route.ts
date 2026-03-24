import { NextRequest, NextResponse } from "next/server";
import { CustomerDataCenter } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type Segment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";
type Status = "active" | "unassigned" | "reassigned";

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
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

function normalizeStatus(value: string | null | undefined): Status | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "active") return "active";
  if (v === "unassigned") return "unassigned";
  if (v === "reassigned") return "reassigned";
  return undefined;
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  let access: Awaited<ReturnType<typeof resolveDataCenterAccess>>;
  try {
    access = await resolveDataCenterAccess(userId, companyId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (access.scope === "agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "rows[] is required" }, { status: 400 });
    }

    const payload = rows.map((row) => {
      const rowObj = (row ?? {}) as Record<string, unknown>;
      const requestedSupervisorUserId = rowObj.supervisorUserId ? String(rowObj.supervisorUserId) : null;
      return {
        companyId,
        customerId: String(rowObj.customerId ?? "").trim(),
        supervisorUserId:
          access.scope === "supervisor" ? access.supervisorUserId : requestedSupervisorUserId,
        agentUserId: rowObj.agentUserId ? String(rowObj.agentUserId) : null,
        segment: normalizeSegment(rowObj.segment ? String(rowObj.segment) : undefined),
        status: normalizeStatus(rowObj.status ? String(rowObj.status) : undefined),
        assignedByUserId: userId,
        reason: rowObj.reason ? String(rowObj.reason) : null,
        action: "bulk_assign" as const,
      };
    });

    if (payload.some((r) => !r.customerId)) {
      return NextResponse.json({ error: "Every row requires customerId" }, { status: 400 });
    }
    if (access.scope === "supervisor" && payload.some((r) => r.supervisorUserId !== access.supervisorUserId)) {
      return NextResponse.json({ error: "Supervisors can only assign their own scope" }, { status: 403 });
    }

    const result = await CustomerDataCenter.bulkAssignCustomers(payload);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("POST /api/company/[companyId]/data-center/assignments/bulk error:", error);
    return NextResponse.json({ error: "Failed to bulk assign customers" }, { status: 500 });
  }
}
