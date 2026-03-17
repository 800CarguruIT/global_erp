import { NextRequest } from "next/server";
import { appendLeadEvent, getLeadById, updateLeadPartial } from "@repo/ai-core/crm/leads/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";
import { normalizeRsaStatus } from "@/lib/leads/rsa-flow";

type Params = { params: Promise<{ companyId: string; leadId: string }> };
type TransitionAction = "accept" | "enroute" | "job_started" | "complete" | "lose";

const allowedStagesByAction: Record<TransitionAction, string[]> = {
  accept: ["new", "assigned", "dispatched", "accepted"],
  enroute: ["assigned", "dispatched", "accepted", "enroute"],
  job_started: ["accepted", "enroute", "inprocess", "processing", "job_started"],
  complete: ["job_started", "inprocess", "processing", "completed"],
  lose: ["new", "assigned", "dispatched", "accepted", "enroute", "inprocess", "processing", "job_started"],
};

function normalizeAction(value: unknown): TransitionAction | null {
  const val = String(value ?? "").trim().toLowerCase();
  if (val === "accept") return "accept";
  if (val === "enroute") return "enroute";
  if (val === "job_started" || val === "start" || val === "jobstarted") return "job_started";
  if (val === "complete" || val === "completed" || val === "done") return "complete";
  if (val === "lose" || val === "lost" || val === "cancel") return "lose";
  return null;
}

function getTransitionState(action: TransitionAction) {
  switch (action) {
    case "accept":
      return { leadStage: "accepted", leadStatus: "pending" as const, eventType: "rsa_accepted" };
    case "enroute":
      return { leadStage: "enroute", leadStatus: "pending" as const, eventType: "rsa_enroute" };
    case "job_started":
      return { leadStage: "job_started", leadStatus: "pending" as const, eventType: "rsa_job_started" };
    case "complete":
      return { leadStage: "completed", leadStatus: "done" as const, eventType: "rsa_completed" };
    case "lose":
      return { leadStage: "lost", leadStatus: "lost" as const, eventType: "rsa_lost" };
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, leadId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const lead = await getLeadById(companyId, leadId);
    if (!lead) return createMobileErrorResponse("Lead not found", 404);
    if (lead.leadType !== "rsa") return createMobileErrorResponse("Transition is supported only for RSA leads", 400);

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const remark = body?.remark === undefined ? undefined : String(body.remark ?? "").trim();
    if (!action) return createMobileErrorResponse("action is required", 400);

    const currentStatus = normalizeRsaStatus(lead.leadStatus);
    if (currentStatus === "done" || currentStatus === "lost") {
      return createMobileErrorResponse("Lead is already closed", 400);
    }

    const allowedStages = allowedStagesByAction[action];
    const currentStage = String(lead.leadStage ?? "new").trim().toLowerCase();
    if (!allowedStages.includes(currentStage)) {
      return createMobileErrorResponse(
        `Invalid transition from stage '${lead.leadStage ?? "unknown"}' using action '${action}'`,
        400
      );
    }

    const assignedUserId = lead.assignedUserId ?? null;
    const mustBeAssignedToActor = action !== "accept";
    if (mustBeAssignedToActor) {
      if (!assignedUserId || assignedUserId !== userId) {
        return createMobileErrorResponse("Only assigned technician can update this lead", 403);
      }
    } else if (assignedUserId && assignedUserId !== userId) {
      return createMobileErrorResponse("This lead is assigned to another technician", 403);
    }

    const next = getTransitionState(action);
    await updateLeadPartial(companyId, leadId, {
      leadStage: next.leadStage,
      leadStatus: next.leadStatus,
      assignedUserId: action === "accept" ? assignedUserId ?? userId : assignedUserId ?? userId,
      assignedAt: action === "accept" ? new Date().toISOString() : lead.assignedAt ?? undefined,
      agentRemark: remark !== undefined ? remark : lead.agentRemark ?? null,
    });

    await appendLeadEvent({
      companyId,
      leadId,
      actorUserId: userId,
      eventType: next.eventType,
      eventPayload: {
        action,
        from: { leadStage: lead.leadStage, leadStatus: lead.leadStatus },
        to: { leadStage: next.leadStage, leadStatus: next.leadStatus },
        remark: remark ?? null,
      },
    });

    const updated = await getLeadById(companyId, leadId);
    return createMobileSuccessResponse({ lead: updated ?? lead });
  } catch (error) {
    console.error("POST /api/mobile/company/[companyId]/rsa/leads/[leadId]/transition error:", error);
    return handleMobileError(error);
  }
}

