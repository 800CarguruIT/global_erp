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
import type {
  EstimateItemCostType,
  EstimateItemStatus,
  EstimateStatus,
} from "@repo/ai-core/workshop/estimates/types";
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
      approvedType?: EstimateItemCostType | null;
      approvedCost?: number | null;
    }>;

    let inspectionItems: Awaited<ReturnType<typeof listInspectionLineItems>> = [];
    if (estimate?.inspectionId) {
      inspectionItems = await listInspectionLineItems(estimate.inspectionId, { isAdd: 0 });
    }
    const existingEstimateItems = estimateData?.items ?? [];
    const existingById = new Map(existingEstimateItems.map((row) => [String(row.id), row]));
    const existingByInspectionItemId = new Map(
      existingEstimateItems
        .filter((row) => row.inspectionItemId)
        .map((row) => [String(row.inspectionItemId), row])
    );
    const inspectionItemById = new Map(inspectionItems.map((row) => [String(row.id), row]));
    const isReceivedLineItem = (lineItem: any | null | undefined) =>
      String(lineItem?.orderStatus ?? lineItem?.order_status ?? "").trim().toLowerCase() === "received";
    const normalizeText = (value?: string | null) => String(value ?? "").trim();
    const normalizeStatus = (value?: string | null) => String(value ?? "pending").trim().toLowerCase();
    const normalizeCostType = (value?: string | null) => String(value ?? "").trim().toLowerCase();
    const normalizeNum = (value: unknown) => Number(value ?? 0);
    const hasEstimateItemChanged = (
      existing: (typeof existingEstimateItems)[number],
      incoming: (typeof items)[number]
    ) => {
      return (
        normalizeText(existing.partName) !== normalizeText(incoming.partName) ||
        normalizeText(existing.description) !== normalizeText(incoming.description ?? null) ||
        normalizeText(existing.type) !== normalizeText(incoming.type) ||
        normalizeNum(existing.quantity) !== normalizeNum(incoming.quantity ?? 1) ||
        normalizeNum(existing.cost) !== normalizeNum(incoming.cost ?? 0) ||
        normalizeStatus(existing.status) !== normalizeStatus(incoming.status ?? "pending") ||
        normalizeCostType((existing as any).approvedType ?? null) !==
          normalizeCostType((incoming as any).approvedType ?? null) ||
        normalizeNum((existing as any).approvedCost ?? null) !==
          normalizeNum((incoming as any).approvedCost ?? null)
      );
    };
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
    const normalizeApprovedType = (
      value?: EstimateItemCostType | null
    ): "oe" | "oem" | "aftm" | "used" | null => {
      const v = String(value ?? "").trim().toLowerCase();
      if (v === "oe" || v === "oem" || v === "aftm" || v === "used") return v;
      return null;
    };
    const mappedItems = [];
    for (const [idx, item] of items.entries()) {
      let inspectionItemId = item.inspectionItemId ?? null;
      const existingEstimateItem =
        (item.id ? existingById.get(String(item.id)) : null) ??
        (inspectionItemId ? existingByInspectionItemId.get(String(inspectionItemId)) : null) ??
        null;
      if (estimate?.inspectionId) {
        const directInspectionItem =
          inspectionItemId ? inspectionItemById.get(String(inspectionItemId)) ?? null : null;
        if (isReceivedLineItem(directInspectionItem) && existingEstimateItem && hasEstimateItemChanged(existingEstimateItem, item)) {
          return NextResponse.json(
            { error: `Received part "${existingEstimateItem.partName}" is locked and cannot be updated.` },
            { status: 400 }
          );
        }
        if (inspectionItemId) {
          await updateInspectionLineItem({
            companyId,
            lineItemId: inspectionItemId,
            patch: {
              productName: item.partName,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              status: mapStatus(item.status),
              approvedType: normalizeApprovedType(item.approvedType ?? null),
            },
          });
          usedLineItemIds.add(inspectionItemId);
        } else {
          const match = findMatchingLineItem(item.partName, item.description ?? null);
          if (match) {
            if (isReceivedLineItem(match) && existingEstimateItem && hasEstimateItemChanged(existingEstimateItem, item)) {
              return NextResponse.json(
                { error: `Received part "${existingEstimateItem.partName}" is locked and cannot be updated.` },
                { status: 400 }
              );
            }
            inspectionItemId = match.id;
            await updateInspectionLineItem({
              companyId,
              lineItemId: inspectionItemId,
              patch: {
                productName: item.partName,
                description: item.description ?? null,
                quantity: item.quantity ?? 1,
                status: mapStatus(item.status),
                approvedType: normalizeApprovedType(item.approvedType ?? null),
              },
            });
            usedLineItemIds.add(inspectionItemId);
          } else {
            const created = await createInspectionLineItem({
              companyId,
              inspectionId: estimate.inspectionId,
              leadId: estimate.leadId ?? null,
              source: "estimate",
              isAdd: 0,
              productName: item.partName,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              status: mapStatus(item.status),
              approvedType: normalizeApprovedType(item.approvedType ?? null),
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
          approvedType: (item as any).approvedType ?? null,
          approvedCost: (item as any).approvedCost ?? null,
        });
      }

    const receivedInspectionIds = new Set(
      inspectionItems
        .filter((li) => String(li?.orderStatus ?? li?.order_status ?? "").trim().toLowerCase() === "received")
        .map((li) => String(li.id))
    );
    const mappedInspectionIds = new Set(
      mappedItems
        .map((row: any) => String(row.inspectionItemId ?? "").trim())
        .filter(Boolean)
    );
    const removedReceivedEstimateItem = existingEstimateItems.find((row) => {
      const inspectionItemId = String(row.inspectionItemId ?? "").trim();
      if (!inspectionItemId) return false;
      if (!receivedInspectionIds.has(inspectionItemId)) return false;
      return !mappedInspectionIds.has(inspectionItemId);
    });
    if (removedReceivedEstimateItem) {
      return NextResponse.json(
        { error: `Received part "${removedReceivedEstimateItem.partName}" cannot be removed from estimate.` },
        { status: 400 }
      );
    }

    await replaceEstimateItems(estimateId, mappedItems);
  }

  return NextResponse.json({ ok: true });
}
