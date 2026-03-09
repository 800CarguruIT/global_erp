import { NextRequest } from "next/server";
import { WorkshopInspections } from "@repo/ai-core";
import { z } from "zod";
import {
  resolveWorkshopAccess,
  workshopError,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "../utils";

const createInspectionSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  carId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  inspectorEmployeeId: z.string().uuid().nullable().optional(),
  advisorEmployeeId: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  startAt: z.string().datetime().nullable().optional(),
  completeAt: z.string().datetime().nullable().optional(),
  customerRemark: z.string().nullable().optional(),
  agentRemark: z.string().nullable().optional(),
  draftPayload: z.record(z.any()).nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const access = resolveWorkshopAccess(req, "read");
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? undefined) as
      | "pending"
      | "completed"
      | "cancelled"
      | undefined;
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const customerId = url.searchParams.get("customerId");

    const items = customerId
      ? await WorkshopInspections.listInspectionsForCustomer(access.companyId, customerId, { status, limit })
      : await WorkshopInspections.listInspectionsForCompany(access.companyId, { status, limit });

    return workshopSuccess({ items, count: items.length, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = resolveWorkshopAccess(req, "write");
    const body = await req.json().catch(() => null);
    const parsed = createInspectionSchema.safeParse(body);
    if (!parsed.success) {
      return workshopError("Invalid payload", 400, { details: parsed.error.format() });
    }

    const inspection = await WorkshopInspections.createInspection({
      companyId: access.companyId,
      ...parsed.data,
    });
    return workshopSuccess({ inspection, companyId: access.companyId }, 201);
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
