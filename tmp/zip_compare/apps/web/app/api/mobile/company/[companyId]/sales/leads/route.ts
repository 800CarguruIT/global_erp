import { NextRequest } from "next/server";
import {
  appendLeadEvent,
  createLead,
  getLeadById,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;

    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    const customerId =
      body?.customerId != null ? String(body.customerId).trim() : "";
    const leadType = String(body?.leadType ?? "rsa")
      .trim()
      .toLowerCase();
    const source =
      body?.source != null ? String(body.source).trim() || null : null;
    const serviceType =
      body?.serviceType != null
        ? String(body.serviceType).trim() || null
        : null;
    const recoveryDirection =
      body?.recoveryDirection != null
        ? String(body.recoveryDirection).trim() || null
        : null;
    const recoveryFlow =
      body?.recoveryFlow != null
        ? String(body.recoveryFlow).trim() || null
        : null;
    const pickupFrom =
      body?.pickupFrom != null ? String(body.pickupFrom).trim() || null : null;
    const pickupGoogleLocation =
      body?.pickupGoogleLocation != null
        ? String(body.pickupGoogleLocation).trim() || null
        : null;
    const dropoffTo =
      body?.dropoffTo != null ? String(body.dropoffTo).trim() || null : null;
    const dropoffGoogleLocation =
      body?.dropoffGoogleLocation != null
        ? String(body.dropoffGoogleLocation).trim() || null
        : null;
    const agentRemarks =
      body?.agentRemarks != null
        ? String(body.agentRemarks).trim() || null
        : null;
    const customerRemarks =
      body?.customerRemarks != null
        ? String(body.customerRemarks).trim() || null
        : null;
    const carId =
      body?.car?.id != null
        ? String(body.car.id).trim() || null
        : body?.carId != null
          ? String(body.carId).trim() || null
          : null;

    if (!customerId) {
      return createMobileErrorResponse("customerId is required", 400);
    }

    if (!["rsa", "recovery", "workshop"].includes(leadType)) {
      return createMobileErrorResponse("Unsupported leadType", 400);
    }

    const lead = await createLead({
      companyId,
      customerId,
      carId,
      leadType: leadType as "rsa" | "recovery" | "workshop",
      source,
      serviceType,
      recoveryDirection: leadType === "recovery" ? recoveryDirection : null,
      recoveryFlow: leadType === "recovery" ? recoveryFlow : null,
      pickupFrom,
      pickupGoogleLocation: pickupGoogleLocation ?? pickupFrom,
      dropoffTo: leadType === "recovery" ? dropoffTo : null,
      dropoffGoogleLocation:
        leadType === "recovery" ? (dropoffGoogleLocation ?? dropoffTo) : null,
      leadStage: "new",
    });

    if (agentRemarks || customerRemarks) {
      await updateLeadPartial(companyId, lead.id, {
        agentRemark: agentRemarks,
        customerRemark: customerRemarks,
      });
    }

    await appendLeadEvent({
      companyId,
      leadId: lead.id,
      actorUserId: userId,
      eventType: "lead_created",
      eventPayload: {
        source,
        leadType,
      },
    });

    const refreshed = await getLeadById(companyId, lead.id);
    return createMobileSuccessResponse({ lead: refreshed ?? lead }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/sales/leads error:",
      error,
    );
    return handleMobileError(error);
  }
}
