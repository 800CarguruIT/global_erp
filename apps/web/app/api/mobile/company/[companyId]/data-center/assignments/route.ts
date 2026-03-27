import { NextRequest } from "next/server";
import { CustomerDataCenter } from "@repo/ai-core/server";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import { resolveDataCenterAccess } from "@/lib/data-center/access";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };
type Segment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";
type Status = "all" | "active" | "unassigned" | "reassigned";

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

function normalizeStatus(value: string | null | undefined): Status {
  if (!value) return "active";
  const v = value.trim().toLowerCase();
  if (v === "all" || v === "active" || v === "unassigned" || v === "reassigned") return v;
  return "active";
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);
    const access = await resolveDataCenterAccess(userId, companyId);

    const url = new URL(req.url);
    const pageRaw = Number(url.searchParams.get("page"));
    const pageSizeRaw = Number(url.searchParams.get("pageSize"));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 25;
    const search = url.searchParams.get("search") ?? "";
    const segment = normalizeSegment(url.searchParams.get("segment"));
    const status = normalizeStatus(url.searchParams.get("status"));

    const supervisorUserId =
      access.scope === "supervisor" ? access.supervisorUserId : undefined;
    const agentUserId = access.scope === "agent" ? access.agentUserId : undefined;

    const result = await CustomerDataCenter.listCustomerAssignments({
      companyId,
      page,
      pageSize,
      search,
      segment,
      status,
      supervisorUserId,
      agentUserId,
    });

    return createMobileSuccessResponse({
      assignments: result.data,
      meta: result.meta,
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/data-center/assignments error:", error);
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);
    const access = await resolveDataCenterAccess(userId, companyId);
    if (access.scope === "agent") {
      return createMobileErrorResponse("Forbidden", 403);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const customerId = String(body.customerId ?? "").trim();
    if (!customerId) return createMobileErrorResponse("customerId is required", 400);

    const requestedSupervisorUserId = body.supervisorUserId ? String(body.supervisorUserId) : null;
    if (access.scope === "supervisor" && requestedSupervisorUserId && requestedSupervisorUserId !== access.supervisorUserId) {
      return createMobileErrorResponse("Supervisors can only assign their own scope", 403);
    }

    const row = await CustomerDataCenter.assignCustomer({
      companyId,
      customerId,
      supervisorUserId:
        access.scope === "supervisor" ? access.supervisorUserId : requestedSupervisorUserId,
      agentUserId: body.agentUserId ? String(body.agentUserId) : null,
      segment: normalizeSegment(body.segment ? String(body.segment) : undefined),
      status: normalizeStatus(body.status ? String(body.status) : undefined),
      assignedByUserId: userId,
      reason: body.reason ? String(body.reason) : null,
      action: "reassign",
    });

    return createMobileSuccessResponse({ assignment: row });
  } catch (error) {
    console.error("PATCH /api/mobile/company/[companyId]/data-center/assignments error:", error);
    return handleMobileError(error);
  }
}
