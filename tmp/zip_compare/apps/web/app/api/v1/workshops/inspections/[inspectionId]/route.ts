import { NextRequest } from "next/server";
import { WorkshopInspections } from "@repo/ai-core";
import { z } from "zod";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  resolveWorkshopAccess,
  workshopError,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "../../utils";

type ParamsCtx =
  | { params: { inspectionId: string } }
  | { params: Promise<{ inspectionId: string }> };

const patchInspectionSchema = z.object({
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  startAt: z.string().datetime().nullable().optional(),
  completeAt: z.string().datetime().nullable().optional(),
  verifiedBy: z.string().uuid().nullable().optional(),
  verifiedAt: z.string().datetime().nullable().optional(),
  cancelledBy: z.string().uuid().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
  cancelRemarks: z.string().nullable().optional(),
  healthEngine: z.number().nullable().optional(),
  healthTransmission: z.number().nullable().optional(),
  healthBrakes: z.number().nullable().optional(),
  healthSuspension: z.number().nullable().optional(),
  healthElectrical: z.number().nullable().optional(),
  overallHealth: z.number().nullable().optional(),
  customerRemark: z.string().nullable().optional(),
  agentRemark: z.string().nullable().optional(),
  inspectorRemark: z.string().nullable().optional(),
  inspectorRemarkLayman: z.string().nullable().optional(),
  aiSummaryMarkdown: z.string().nullable().optional(),
  aiSummaryPlain: z.string().nullable().optional(),
  draftPayload: z.record(z.any()).nullable().optional(),
});

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "read");
    const { inspectionId } = await ctx.params;
    const inspection = await WorkshopInspections.getInspectionById(access.companyId, inspectionId);
    if (!inspection) return workshopError("Inspection not found", 404);
    const items = await WorkshopInspections.listInspectionItems(inspectionId);
    const lineItems = await WorkshopInspections.listInspectionLineItems(inspectionId);
    return workshopSuccess({ inspection, items, lineItems, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}

export async function PATCH(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "write");
    const { inspectionId } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = patchInspectionSchema.safeParse(body);
    if (!parsed.success) {
      return workshopError("Invalid payload", 400, { details: parsed.error.format() });
    }

    await WorkshopInspections.updateInspectionPartial(access.companyId, inspectionId, parsed.data);
    const inspection = await WorkshopInspections.getInspectionById(access.companyId, inspectionId);
    if (!inspection) return workshopError("Inspection not found", 404);
    const items = await WorkshopInspections.listInspectionItems(inspectionId);
    const lineItems = await WorkshopInspections.listInspectionLineItems(inspectionId);
    return workshopSuccess({ inspection, items, lineItems, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
