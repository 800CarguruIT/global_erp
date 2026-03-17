import { NextRequest } from "next/server";
import { WorkshopInvoices } from "@repo/ai-core";
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

const createFromQualityCheckSchema = z.object({
  qualityCheckId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "read");
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? undefined) as
      | "draft"
      | "issued"
      | "paid"
      | "cancelled"
      | undefined;
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const items = await WorkshopInvoices.listInvoicesForCompany(access.companyId, { status, limit });
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
      const data = await WorkshopInvoices.createInvoiceFromEstimate(
        access.companyId,
        fromEstimate.data.estimateId
      );
      return workshopSuccess({ ...data, companyId: access.companyId }, 201);
    }

    const fromQualityCheck = createFromQualityCheckSchema.safeParse(body);
    if (fromQualityCheck.success) {
      const data = await WorkshopInvoices.createInvoiceFromQualityCheck(
        access.companyId,
        fromQualityCheck.data.qualityCheckId
      );
      return workshopSuccess({ ...data, companyId: access.companyId }, 201);
    }

    return workshopError("Invalid payload. Use either { estimateId } or { qualityCheckId }", 400);
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
