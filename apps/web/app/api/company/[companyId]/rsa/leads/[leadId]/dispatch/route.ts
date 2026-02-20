import { NextRequest, NextResponse } from "next/server";
import { appendLeadEvent, getLeadById, updateLeadPartial } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { isRsaFinalStatus, normalizeRsaStatus } from "@/lib/leads/rsa-flow";

type Params = { params: Promise<{ companyId: string; leadId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, leadId } = await params;
  const actorUserId = await getCurrentUserIdFromRequest(req);
  const lead = await getLeadById(companyId, leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.leadType !== "rsa") {
    return NextResponse.json({ error: "Dispatch is supported only for RSA leads" }, { status: 400 });
  }
  if (isRsaFinalStatus(lead.leadStatus)) {
    return NextResponse.json({ error: "Lead is already closed" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const assignedUserId = String(body?.assignedUserId ?? "").trim();
  const assignedEmployeeId =
    body?.assignedEmployeeId === null || body?.assignedEmployeeId === undefined
      ? null
      : String(body.assignedEmployeeId).trim() || null;
  const agentRemark = body?.agentRemark === undefined ? undefined : String(body.agentRemark ?? "").trim();
  const branchId =
    body?.branchId === null || body?.branchId === undefined ? undefined : String(body.branchId).trim() || null;

  if (!assignedUserId) {
    return NextResponse.json({ error: "assignedUserId is required" }, { status: 400 });
  }

  const previous = {
    assignedUserId: lead.assignedUserId ?? null,
    leadStage: lead.leadStage ?? null,
    leadStatus: lead.leadStatus ?? null,
    branchId: lead.branchId ?? null,
  };

  await updateLeadPartial(companyId, leadId, {
    assignedUserId,
    assignedAt: new Date().toISOString(),
    branchId,
    leadStage: "dispatched",
    leadStatus: normalizeRsaStatus(lead.leadStatus),
    agentRemark: agentRemark ?? lead.agentRemark ?? null,
  });

  if (assignedEmployeeId) {
    const sql = getSql();
    await sql`
      UPDATE leads
      SET agent_employee_id = ${assignedEmployeeId}, updated_at = now()
      WHERE company_id = ${companyId} AND id = ${leadId}
    `;
  }

  await appendLeadEvent({
    companyId,
    leadId,
    actorUserId,
    eventType: "rsa_dispatched",
    eventPayload: {
      from: previous,
      to: {
        assignedUserId,
        leadStage: "dispatched",
        leadStatus: normalizeRsaStatus(lead.leadStatus),
        branchId: branchId ?? lead.branchId ?? null,
        assignedEmployeeId,
      },
    },
  });

  const updated = await getLeadById(companyId, leadId);
  return NextResponse.json({ data: updated ?? lead });
}

