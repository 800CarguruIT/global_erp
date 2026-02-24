import { NextRequest } from "next/server";
import { z } from "zod";
import { Crm, Leads } from "@repo/ai-core";
import {
  appendLeadEvent,
  createLead,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; customerId: string }> };

const createCustomerLeadActionSchema = z.object({
  action: z.enum(["follow_up", "contract", "create_contract"]),
  carId: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  followUpAt: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const data = await Leads.listLeadsForCustomer(companyId, customerId);
    return createMobileSuccessResponse({ leads: data });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/customers/[customerId]/leads error:", error);
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const json = await req.json();
    const parsed = createCustomerLeadActionSchema.safeParse(json);
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const customer = await Crm.getCustomerWithCars(customerId);
    if (!customer) {
      return createMobileErrorResponse("Customer not found", 404);
    }
    if (customer.company_id !== companyId) {
      return createMobileErrorResponse("Forbidden", 403);
    }

    const carId = parsed.data.carId ? String(parsed.data.carId) : null;
    const linkedCar = carId
      ? (customer.cars ?? []).find((item: any) => item?.car?.id === carId)?.car ?? null
      : null;
    if (carId && !linkedCar) {
      return createMobileErrorResponse("Car not found", 404);
    }

    const normalizedAction =
      parsed.data.action === "create_contract" ? "contract" : parsed.data.action;
    const remarks = parsed.data.remarks?.trim() || null;
    const title = parsed.data.title?.trim() || null;
    const followUpAt = parsed.data.followUpAt ?? null;

    if (normalizedAction === "follow_up" && !remarks) {
      return createMobileErrorResponse("remarks are required for follow-up", 400);
    }
    if (normalizedAction === "contract" && !remarks && !title) {
      return createMobileErrorResponse("title or remarks is required for contract", 400);
    }

    const lead = await createLead({
      companyId,
      customerId: customer.id,
      carId: linkedCar?.id ?? null,
      leadType: "workshop",
      leadStage: normalizedAction === "follow_up" ? "follow_up" : "new",
      source: "walk_in",
    });

    const patch: Record<string, unknown> = {};
    if (remarks) patch.agentRemark = remarks;
    if (title) patch.customerRemark = title;
    if (Object.keys(patch).length > 0) {
      await updateLeadPartial(companyId, lead.id, patch);
    }

    await appendLeadEvent({
      companyId,
      leadId: lead.id,
      eventType: normalizedAction === "follow_up" ? "follow_up_created" : "contract_created",
      eventPayload: {
        title,
        remarks,
        followUpAt,
        carId: linkedCar?.id ?? null,
        source: "customer_action",
      },
    });

    return createMobileSuccessResponse(
      { lead, action: normalizedAction, followUpAt, title },
      201
    );
  } catch (error) {
    console.error("POST /api/mobile/company/[companyId]/customers/[customerId]/leads error:", error);
    return handleMobileError(error);
  }
}
