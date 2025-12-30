import { NextRequest, NextResponse } from "next/server";
import {
  getEstimateWithItems,
  replaceEstimateItems,
  updateEstimateHeader,
} from "@repo/ai-core/workshop/estimates/repository";
import type { EstimateItemStatus, EstimateStatus } from "@repo/ai-core/workshop/estimates/types";

type Params = { params: Promise<{ companyId: string; estimateId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, estimateId } = await params;
  const data = await getEstimateWithItems(companyId, estimateId);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, estimateId } = await params;
  const body = await req.json().catch(() => ({}));

  const headerPatch = {
    status: body.status as EstimateStatus | undefined,
    vatRate: body.vatRate as number | undefined,
    totalDiscount: body.discountAmount as number | undefined,
  };

  await updateEstimateHeader(companyId, estimateId, headerPatch);

  if (Array.isArray(body.items)) {
    const items = body.items as Array<{
      id?: string;
      lineNo?: number;
      partName: string;
      description?: string;
      type: string;
      quantity?: number;
      cost?: number;
      sale?: number;
      gpPercent?: number | null;
      status?: EstimateItemStatus;
      inspectionItemId?: string | null;
    }>;

    await replaceEstimateItems(
      estimateId,
      items.map((i, idx) => ({
        id: i.id,
        lineNo: i.lineNo ?? idx + 1,
        inspectionItemId: i.inspectionItemId ?? null,
        partName: i.partName,
        description: i.description ?? null,
        type: i.type as any,
        quantity: i.quantity ?? 1,
        cost: i.cost ?? 0,
        sale: i.sale ?? 0,
        gpPercent: i.gpPercent ?? null,
        status: i.status ?? ("pending" as EstimateItemStatus),
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
