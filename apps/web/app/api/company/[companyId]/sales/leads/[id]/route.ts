import { NextRequest, NextResponse } from "next/server";
import { appendLeadEvent, deleteLead, getLeadById, updateLeadPartial } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data: lead });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => ({}));
  const {
    status,
    ownerId,
    agentRemark,
    customerRemark,
    branchId,
    assignedUserId,
    serviceType,
    leadStage,
    recoveryDirection,
    recoveryFlow,
  } = body ?? {};

  const branchIdFromBody = branchId === null ? null : branchId ?? lead.branchId ?? null;
  const branchChanged = branchIdFromBody !== lead.branchId;

  await updateLeadPartial(companyId, id, {
    leadStatus: status ?? lead.leadStatus,
    leadStage: leadStage ?? lead.leadStage,
    branchId: branchIdFromBody,
    assignedUserId: assignedUserId ?? lead.assignedUserId ?? null,
    serviceType: serviceType ?? lead.serviceType ?? null,
    recoveryDirection: recoveryDirection ?? lead.recoveryDirection ?? null,
    recoveryFlow: recoveryFlow ?? lead.recoveryFlow ?? null,
    assignedAt: assignedUserId ? new Date().toISOString() : null,
    agentRemark: agentRemark ?? lead.agentRemark,
    customerRemark: customerRemark ?? lead.customerRemark,
    customerFeedback: lead.customerFeedback,
    sentimentScore: lead.sentimentScore,
  });

  if (ownerId && ownerId !== lead.agentEmployeeId) {
    // simple owner update
    const sqlMod = await import("@repo/ai-core/db");
    const sql = sqlMod.getSql();
    await sql`UPDATE leads SET agent_employee_id = ${ownerId} WHERE company_id = ${companyId} AND id = ${id}`;
  }

  const updated = await getLeadById(companyId, id);
  if (updated && branchChanged) {
    await appendLeadEvent({
      companyId,
      leadId: id,
      eventType: "branch_updated",
      eventPayload: { from: lead.branchId ?? null, to: updated.branchId ?? null },
    });
  }

  // If workshop lead gets a branch and has a pickup, update linked recovery pickup lead drop-off to that branch
  if (lead.leadType === "workshop" && branchIdFromBody) {
    try {
      const sql = getSql();
      const branchRows = await sql/* sql */ `
        SELECT id, display_name, name, code, address_line1, google_location
        FROM branches
        WHERE company_id = ${companyId} AND id = ${branchIdFromBody}
        LIMIT 1
      `;
      const branch = branchRows[0];
      const branchLocation =
        branch?.address_line1 ??
        branch?.display_name ??
        branch?.name ??
        branch?.code ??
        branchIdFromBody;
      const branchGoogle = branch?.google_location ?? branchLocation;

      const recoveryRows = await sql/* sql */ `
        SELECT id
        FROM leads
        WHERE company_id = ${companyId}
          AND lead_type = 'recovery'
          AND source = 'workshop_pickup'
          AND (dropoff_to IS NULL OR dropoff_to = '' OR branch_id IS NULL)
      `;
      for (const row of recoveryRows) {
        const recoveryId = row.id as string;
        await updateLeadPartial(companyId, recoveryId, {
          dropoffTo: branchLocation,
          dropoffGoogleLocation: branchGoogle,
          recoveryFlow: "customer_to_branch",
        });
      }
    } catch (err) {
      console.error("Failed to update linked recovery lead drop-off", err);
    }
  }

  // If workshop lead is unassigned from a branch, clear drop-off for linked recovery pickup leads that pointed to that branch
  if (lead.leadType === "workshop" && branchIdFromBody === null && lead.branchId) {
    try {
      const sql = getSql();
      const branchRows = await sql/* sql */ `
        SELECT id, display_name, name, code, address_line1, google_location
        FROM branches
        WHERE company_id = ${companyId} AND id = ${lead.branchId}
        LIMIT 1
      `;
      const branch = branchRows[0];
      const branchLocation =
        branch?.address_line1 ??
        branch?.display_name ??
        branch?.name ??
        branch?.code ??
        lead.branchId;
      const branchGoogle = branch?.google_location ?? null;

      const recoveryRows = await sql/* sql */ `
        SELECT id
        FROM leads
        WHERE company_id = ${companyId}
          AND lead_type = 'recovery'
          AND source = 'workshop_pickup'
          AND (
            dropoff_to = ${branchLocation} OR dropoff_google_location = ${branchGoogle} OR branch_id = ${lead.branchId}
          )
      `;

      for (const row of recoveryRows) {
        const recoveryId = row.id as string;
        await updateLeadPartial(companyId, recoveryId, {
          dropoffTo: null,
          dropoffGoogleLocation: null,
        });
      }
    } catch (err) {
      console.error("Failed to clear linked recovery lead drop-off after unassigning branch", err);
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const { searchParams } = new URL(req.url);
  const archive = searchParams.get("archive") === "true";

  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });

  if (archive) {
    await updateLeadPartial(companyId, id, { isArchived: true });
    const updated = await getLeadById(companyId, id);
    return NextResponse.json({ data: updated });
  }

  await deleteLead(companyId, id);
  return NextResponse.json({ success: true });
}
