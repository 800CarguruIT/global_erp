import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import {
  createInspectionLineItem,
  listInspectionLineItems,
  markApprovedLineItemsOrdered,
  markLineItemsOrderedByNames,
  updateInspectionLineItem,
} from "@repo/ai-core/workshop/inspections/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = {
  params: Promise<{ companyId: string; branchId: string; inspectionId: string }>;
};

async function ensureInspectionInBranch(
  companyId: string,
  branchId: string,
  inspectionId: string,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT i.id
    FROM inspections i
    LEFT JOIN leads l ON l.id = i.lead_id
    WHERE i.company_id = ${companyId}
      AND i.id = ${inspectionId}
      AND COALESCE(i.branch_id, l.branch_id) = ${branchId}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inBranch = await ensureInspectionInBranch(companyId, branchId, inspectionId);
    if (!inBranch) return createMobileErrorResponse("Not found", 404);

    const source = req.nextUrl.searchParams.get("source") as "inspection" | "estimate" | null;
    const items = await listInspectionLineItems(inspectionId, source ? { source } : undefined);
    return createMobileSuccessResponse({ items });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/inspections/[inspectionId]/line-items error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inBranch = await ensureInspectionInBranch(companyId, branchId, inspectionId);
    if (!inBranch) return createMobileErrorResponse("Not found", 404);

    const body = await req.json().catch(() => ({}));
    const lineItemPayload = {
      companyId,
      inspectionId,
      source: body.source ?? "inspection",
      productId: body.productId ?? null,
      productName: body.productName ?? null,
      description: body.description ?? null,
      quantity: body.quantity ?? 1,
      reason: body.reason ?? null,
      status: body.status ?? "Pending",
      mediaFileId: body.mediaFileId ?? null,
    };

    if (body?.id) {
      const updated = await updateInspectionLineItem({
        companyId,
        lineItemId: body.id,
        patch: {
          productId: lineItemPayload.productId,
          productName: lineItemPayload.productName,
          description: lineItemPayload.description,
          quantity: lineItemPayload.quantity,
          reason: lineItemPayload.reason,
          status: lineItemPayload.status,
          mediaFileId: lineItemPayload.mediaFileId,
        },
      });
      if (!updated) return createMobileErrorResponse("Line item not found", 404);
      return createMobileSuccessResponse({ lineItem: updated });
    }

    const created = await createInspectionLineItem({
      ...lineItemPayload,
      leadId: body.leadId ?? null,
    });
    return createMobileSuccessResponse({ lineItem: created }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/branches/[branchId]/workshop/inspections/[inspectionId]/line-items error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inBranch = await ensureInspectionInBranch(companyId, branchId, inspectionId);
    if (!inBranch) return createMobileErrorResponse("Not found", 404);

    const body = await req.json().catch(() => ({}));
    if (body?.action !== "order_approved") {
      return createMobileErrorResponse("Invalid action", 400);
    }

    const approvedNames = Array.isArray(body?.approvedNames) ? body.approvedNames : [];
    const updated = approvedNames.length
      ? await markLineItemsOrderedByNames(inspectionId, approvedNames)
      : await markApprovedLineItemsOrdered(inspectionId);
    return createMobileSuccessResponse({ updated });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/branches/[branchId]/workshop/inspections/[inspectionId]/line-items error:",
      error,
    );
    return handleMobileError(error);
  }
}
