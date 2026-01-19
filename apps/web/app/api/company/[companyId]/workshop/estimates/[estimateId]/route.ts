import { NextRequest, NextResponse } from "next/server";
import {
  getEstimateWithItems,
  replaceEstimateItems,
  updateEstimateHeader,
} from "@repo/ai-core/workshop/estimates/repository";
import {
  createInspectionLineItem,
  listInspectionLineItems,
  updateInspectionLineItem,
} from "@repo/ai-core/workshop/inspections/repository";
import type { EstimateItemStatus, EstimateStatus } from "@repo/ai-core/workshop/estimates/types";
import type { LineItemStatus } from "@repo/ai-core/workshop/inspections/types";

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
  const estimateData = await getEstimateWithItems(companyId, estimateId);
  const estimate = estimateData?.estimate ?? null;

  const headerPatch: {
    status?: EstimateStatus;
    vatRate?: number;
    totalDiscount?: number;
    meta?: any;
  } = {
    status: body.status as EstimateStatus | undefined,
    vatRate: body.vatRate as number | undefined,
    totalDiscount: body.discountAmount as number | undefined,
  };
  if (body.meta !== undefined) {
    headerPatch.meta = body.meta;
  }

  await updateEstimateHeader(companyId, estimateId, headerPatch);

  if (Array.isArray(body.items)) {
    const items = body.items as Array<{
      id?: string;
      lineNo?: number;
      inspectionItemId?: string | null;
      partName: string;
      description?: string;
      type: string;
      quantity?: number;
      cost?: number;
      sale?: number;
      gpPercent?: number | null;
      status?: EstimateItemStatus;
    }>;

    let inspectionItems: Awaited<ReturnType<typeof listInspectionLineItems>> = [];
    if (estimate?.inspectionId) {
      inspectionItems = await listInspectionLineItems(estimate.inspectionId);
    }
    const usedLineItemIds = new Set<string>();
    const findMatchingLineItem = (name: string, description?: string | null) => {
      const normalizedName = (name ?? "").trim().toLowerCase();
      const normalizedDesc = (description ?? "").trim().toLowerCase();
      const candidates = inspectionItems.filter((li) => {
        if (usedLineItemIds.has(li.id)) return false;
        const liName = (li.productName ?? "").trim().toLowerCase();
        if (liName !== normalizedName) return false;
        if (normalizedDesc && (li.description ?? "").trim().toLowerCase() !== normalizedDesc) {
          return false;
        }
        return true;
      });
      return candidates[0] ?? null;
    };
    const mapStatus = (status?: EstimateItemStatus): LineItemStatus => {
      if (status === "approved") return "Approved";
      if (status === "rejected") return "Rejected";
      if (status === "inquiry") return "Inquiry";
      return "Pending";
    };
    const mappedItems = [];
    for (const [idx, item] of items.entries()) {
      let inspectionItemId = item.inspectionItemId ?? null;
      if (estimate?.inspectionId) {
        if (inspectionItemId) {
          await updateInspectionLineItem({
            companyId,
            lineItemId: inspectionItemId,
            patch: {
              productName: item.partName,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              status: mapStatus(item.status),
            },
          });
          usedLineItemIds.add(inspectionItemId);
        } else {
          const match = findMatchingLineItem(item.partName, item.description ?? null);
          if (match) {
            inspectionItemId = match.id;
            await updateInspectionLineItem({
              companyId,
              lineItemId: inspectionItemId,
              patch: {
                productName: item.partName,
                description: item.description ?? null,
                quantity: item.quantity ?? 1,
                status: mapStatus(item.status),
              },
            });
            usedLineItemIds.add(inspectionItemId);
          } else {
            const created = await createInspectionLineItem({
              companyId,
              inspectionId: estimate.inspectionId,
              leadId: estimate.leadId ?? null,
              source: "estimate",
              productName: item.partName,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              status: mapStatus(item.status),
            });
            inspectionItemId = created.id;
            usedLineItemIds.add(inspectionItemId);
          }
        }
      }
      mappedItems.push({
        id: item.id,
        lineNo: item.lineNo ?? idx + 1,
        inspectionItemId,
        partName: item.partName,
        description: item.description ?? null,
        type: item.type as any,
        quantity: item.quantity ?? 1,
        cost: item.cost ?? 0,
        sale: item.sale ?? 0,
        gpPercent: item.gpPercent ?? null,
        status: item.status ?? ("pending" as EstimateItemStatus),
      });
    }

    await replaceEstimateItems(estimateId, mappedItems);
  }

  return NextResponse.json({ ok: true });
}
