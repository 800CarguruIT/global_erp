import { NextRequest } from "next/server";
import { WorkshopWorkOrders } from "@repo/ai-core";
import { z } from "zod";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  resolveWorkshopAccess,
  workshopError,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "../../utils";

type ParamsCtx = { params: { workOrderId: string } } | { params: Promise<{ workOrderId: string }> };

const patchSchema = z.object({
  status: z
    .enum(["draft", "quoting", "queue", "waiting_parts", "ready", "in_progress", "completed", "closed"])
    .optional(),
  branchId: z.string().uuid().nullable().optional(),
  queueReason: z.string().nullable().optional(),
  workStartedAt: z.string().datetime().nullable().optional(),
  workCompletedAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.any()).nullable().optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        workStatus: z.enum(["pending", "waiting_parts", "ready", "in_progress", "completed"]).optional(),
        issuedQty: z.number().nonnegative().optional(),
      })
    )
    .optional(),
});

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "read");
    const { workOrderId } = await ctx.params;
    const data = await WorkshopWorkOrders.getWorkOrderWithItems(access.companyId, workOrderId);
    if (!data) return workshopError("Work order not found", 404);
    return workshopSuccess({ ...data, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}

export async function PATCH(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "write");
    const { workOrderId } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return workshopError("Invalid payload", 400, { details: parsed.error.format() });
    }

    const patch = parsed.data;
    await WorkshopWorkOrders.updateWorkOrderHeader(access.companyId, workOrderId, {
      status: patch.status,
      branchId: patch.branchId,
      queueReason: patch.queueReason,
      workStartedAt: patch.workStartedAt,
      workCompletedAt: patch.workCompletedAt,
      meta: patch.meta,
    });

    if (patch.items?.length) {
      await WorkshopWorkOrders.updateWorkOrderItemsStatuses(access.companyId, workOrderId, patch.items);
    }

    const refreshed = await WorkshopWorkOrders.getWorkOrderWithItems(access.companyId, workOrderId);
    if (!refreshed) return workshopError("Work order not found", 404);
    return workshopSuccess({ ...refreshed, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
