import { NextRequest } from "next/server";
import {
  appendLeadEvent,
  getLeadById,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import {
  createInspection,
  getLatestInspectionForLead,
} from "@repo/ai-core/workshop/inspections/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";
import { normalizeRsaStatus } from "@/lib/leads/rsa-flow";

type Params = { params: Promise<{ companyId: string; leadId: string }> };

function respondNotFound() {
  return createMobileErrorResponse("Not found", 404);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, leadId } = await params;

    await ensureCompanyAccess(userId, companyId);

    const lead = await getLeadById(companyId, leadId);
    if (!lead) return respondNotFound();

    return createMobileSuccessResponse({ lead });
  } catch (error) {
    console.error("GET /api/mobile/leads/[leadId] error:", error);
    return handleMobileError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, leadId } = await params;

    await ensureCompanyAccess(userId, companyId);

    const lead = await getLeadById(companyId, leadId);
    if (!lead) return respondNotFound();

    const body = await req.json().catch(() => ({}));
    const {
      status,
      ownerId,
      agentRemark,
      customerRemark,
      carInVideo,
      carOutVideo,
      branchId,
      assignedUserId,
      serviceType,
      leadStage,
      recoveryDirection,
      recoveryFlow,
      ensureInspection,
    } = body ?? {};

    const branchIdFromBody =
      branchId === null ? null : (branchId ?? lead.branchId ?? null);
    const branchChanged = branchIdFromBody !== lead.branchId;
    const nextAssignedUserId = assignedUserId ?? lead.assignedUserId ?? null;
    const normalizedStatusForUpdate =
      status === undefined || status === null || status === ""
        ? lead.leadStatus
        : lead.leadType === "rsa"
          ? normalizeRsaStatus(status)
          : status;
    const nextLeadStatus = normalizedStatusForUpdate ?? lead.leadStatus;
    const assignmentRequested =
      lead.leadType === "workshop" &&
      nextLeadStatus === "car_in" &&
      (branchIdFromBody || nextAssignedUserId) &&
      (branchChanged || nextAssignedUserId !== lead.assignedUserId || ensureInspection === true);

    if (assignmentRequested) {
      const latestInspection = await getLatestInspectionForLead(companyId, leadId);
      const isVerified = Boolean(latestInspection?.verifiedAt ?? (latestInspection as any)?.verified_at);
      if (isVerified) {
        return createMobileErrorResponse("Inspection already verified. Reassign/assign is not allowed.", 400);
      }
    }

    await updateLeadPartial(companyId, leadId, {
      leadStatus: normalizedStatusForUpdate ?? lead.leadStatus,
      leadStage: leadStage ?? lead.leadStage,
      branchId: branchIdFromBody,
      assignedUserId: nextAssignedUserId,
      serviceType: serviceType ?? lead.serviceType ?? null,
      recoveryDirection: recoveryDirection ?? lead.recoveryDirection ?? null,
      recoveryFlow: recoveryFlow ?? lead.recoveryFlow ?? null,
      assignedAt: nextAssignedUserId ? new Date().toISOString() : null,
      agentRemark: agentRemark ?? lead.agentRemark,
      customerRemark: customerRemark ?? lead.customerRemark,
      carInVideo: carInVideo ?? (lead as any).carInVideo ?? null,
      carOutVideo: carOutVideo ?? (lead as any).carOutVideo ?? null,
      customerFeedback: lead.customerFeedback,
      sentimentScore: lead.sentimentScore,
    });

    if (ownerId && ownerId !== lead.agentEmployeeId) {
      const sql = getSql();
      await sql`UPDATE leads SET agent_employee_id = ${ownerId} WHERE company_id = ${companyId} AND id = ${leadId}`;
    }

    const updated = await getLeadById(companyId, leadId);
    if (updated && branchChanged) {
      await appendLeadEvent({
        companyId,
        leadId,
        eventType: "branch_updated",
        eventPayload: {
          from: lead.branchId ?? null,
          to: updated.branchId ?? null,
        },
      });
    }

    if (assignmentRequested) {
      try {
        const existing = await getLatestInspectionForLead(companyId, leadId);
        if (!existing) {
          await createInspection({
            companyId,
            leadId,
            carId: lead.carId ?? null,
            customerId: lead.customerId ?? null,
            branchId: branchIdFromBody ?? null,
            status: "pending",
          });
        } else {
          const sql = getSql();
          await sql`
            UPDATE inspections
            SET status = 'cancelled',
                cancelled_by = ${userId},
                cancelled_at = ${new Date().toISOString()},
                cancel_remarks = ${"Inspection reassigned to another workshop/branch."}
            WHERE company_id = ${companyId} AND id = ${existing.id}
          `;
          await createInspection({
            companyId,
            leadId,
            carId: lead.carId ?? null,
            customerId: lead.customerId ?? null,
            branchId: branchIdFromBody ?? null,
            status: "pending",
          });
        }
      } catch (err) {
        console.error("Failed to create inspection after assignment", err);
      }
    }

    if (lead.leadType === "workshop" && branchIdFromBody) {
      try {
        const sql = getSql();
        const branchRows = await sql`
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

        const recoveryRows = await sql`
          SELECT id
          FROM leads
          WHERE company_id = ${companyId}
            AND lead_type = 'recovery'
            AND source = 'workshop_pickup'
            AND (dropoff_to IS NULL OR dropoff_to = '' OR branch_id IS NULL)
        `;
        for (const row of recoveryRows) {
          await updateLeadPartial(companyId, row.id, {
            dropoffTo: branchLocation,
            dropoffGoogleLocation: branchGoogle,
            recoveryFlow: "customer_to_branch",
          });
        }
      } catch (err) {
        console.error("Failed to update linked recovery lead drop-off", err);
      }
    }

    if (
      lead.leadType === "workshop" &&
      branchIdFromBody === null &&
      lead.branchId
    ) {
      try {
        const sql = getSql();
        const branchRows = await sql`
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
        const recoveryRows = await sql`
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
          await updateLeadPartial(companyId, row.id, {
            dropoffTo: null,
            dropoffGoogleLocation: null,
          });
        }
      } catch (err) {
        console.error(
          "Failed to clear linked recovery lead drop-off after unassigning branch",
          err,
        );
      }
    }

    return createMobileSuccessResponse({ lead: updated ?? lead });
  } catch (error) {
    console.error("PUT /api/mobile/leads/[leadId] error:", error);
    return handleMobileError(error);
  }
}
