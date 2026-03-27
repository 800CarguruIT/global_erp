import { NextRequest, NextResponse } from "next/server";
import { CustomerDataCenter } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type Segment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";
type Status = "active" | "unassigned" | "reassigned";
type Action = "assign" | "reassign" | "unassign" | "bulk_assign" | "update";

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

function normalizeSegment(
  value: string | null | undefined
): Segment | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "chsc") return "chsc";
  if (v === "non_chsc" || v === "non-chsc") return "non_chsc";
  if (v === "insurance") return "insurance";
  if (v === "warranty" || v === "battery-warranty") return "warranty";
  if (v === "unknown") return "unknown";
  return undefined;
}

function normalizeStatus(
  value: string | null | undefined
): Status | "all" | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "active") return "active";
  if (v === "unassigned") return "unassigned";
  if (v === "reassigned") return "reassigned";
  if (v === "all") return "all";
  return undefined;
}

function normalizeAction(value: string | null | undefined): Action | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "assign") return "assign";
  if (v === "reassign") return "reassign";
  if (v === "unassign") return "unassign";
  if (v === "bulk_assign") return "bulk_assign";
  if (v === "update") return "update";
  return undefined;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
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

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
  const search = url.searchParams.get("search") ?? "";
  const supervisorUserIdRaw = url.searchParams.get("supervisorUserId");
  const agentUserIdRaw = url.searchParams.get("agentUserId");
  const segment = normalizeSegment(url.searchParams.get("segment"));
  const status = normalizeStatus(url.searchParams.get("status"));

  let supervisorUserId = supervisorUserIdRaw || undefined;
  let agentUserId = agentUserIdRaw || undefined;
  if (access.scope === "supervisor") {
    supervisorUserId = access.supervisorUserId;
    agentUserId = agentUserIdRaw || undefined;
  } else if (access.scope === "agent") {
    agentUserId = access.agentUserId;
    supervisorUserId = undefined;
  }

  try {
    const data = await CustomerDataCenter.listCustomerAssignments({
      companyId,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
      search,
      supervisorUserId,
      agentUserId,
      segment,
      status,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/company/[companyId]/data-center/assignments error:", error);
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
  }
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
    const customerId = String(body.customerId ?? "").trim();
    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const requestedSupervisorUserId = body.supervisorUserId ? String(body.supervisorUserId) : null;
    if (access.scope === "supervisor" && requestedSupervisorUserId && requestedSupervisorUserId !== access.supervisorUserId) {
      return NextResponse.json({ error: "Supervisors can only assign their own scope" }, { status: 403 });
    }

    const row = await CustomerDataCenter.assignCustomer({
      companyId,
      customerId,
      supervisorUserId:
        access.scope === "supervisor" ? access.supervisorUserId : requestedSupervisorUserId,
      agentUserId: body.agentUserId ? String(body.agentUserId) : null,
      segment: normalizeSegment(body.segment ? String(body.segment) : undefined),
      status: normalizeStatus(body.status ? String(body.status) : undefined) as Status | undefined,
      assignedByUserId: userId,
      reason: body.reason ? String(body.reason) : null,
      action: normalizeAction(body.action ? String(body.action) : undefined),
    });

    return NextResponse.json({ data: row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("customerId is required")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("POST /api/company/[companyId]/data-center/assignments error:", error);
    return NextResponse.json({ error: "Failed to save assignment" }, { status: 500 });
  }
}
