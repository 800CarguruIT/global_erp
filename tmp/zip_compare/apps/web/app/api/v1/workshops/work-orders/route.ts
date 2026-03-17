import { NextRequest } from "next/server";
import { WorkshopWorkOrders } from "@repo/ai-core";
import { z } from "zod";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  resolveWorkshopAccess,
  workshopError,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "../utils";

const createFromEstimateSchema = z.object({
  estimateId: z.string().uuid(),
});

const createFromInspectionSchema = z.object({
  inspectionId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  carId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "read");
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? undefined) as
      | "draft"
      | "quoting"
      | "queue"
      | "waiting_parts"
      | "ready"
      | "in_progress"
      | "completed"
      | "closed"
      | undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;

    const items = await WorkshopWorkOrders.listWorkOrdersForCompany(access.companyId, {
      status,
      branchId,
    });
    return workshopSuccess({ items, count: items.length, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "write");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return workshopError("Invalid JSON body", 400);
    }

    const fromEstimate = createFromEstimateSchema.safeParse(body);
    if (fromEstimate.success) {
      const data = await WorkshopWorkOrders.createWorkOrderFromEstimate(
        access.companyId,
        fromEstimate.data.estimateId
      );
      return workshopSuccess({ ...data, companyId: access.companyId }, 201);
    }

    const fromInspection = createFromInspectionSchema.safeParse(body);
    if (fromInspection.success) {
      const workOrder = await WorkshopWorkOrders.createWorkOrderForInspection(
        access.companyId,
        fromInspection.data.inspectionId,
        fromInspection.data.leadId ?? null,
        fromInspection.data.carId ?? null,
        fromInspection.data.customerId ?? null
      );
      return workshopSuccess({ workOrder, companyId: access.companyId }, 201);
    }

    return workshopError(
      "Invalid payload. Use either { estimateId } or { inspectionId, leadId?, carId?, customerId? }",
      400
    );
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
