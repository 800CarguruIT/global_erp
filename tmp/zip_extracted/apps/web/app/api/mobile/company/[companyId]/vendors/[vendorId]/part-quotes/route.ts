import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

function toNumberOrNull(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toStringOrNull(value: any) {
  const str = value?.toString?.().trim?.() ?? "";
  return str.length ? str : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, vendorId } = await params;
    await ensureCompanyAccess(userId, companyId);

    if (!companyId || !vendorId) {
      return createMobileErrorResponse(
        "companyId and vendorId are required",
        400,
      );
    }

    const body = await req.json().catch(() => ({}));
    const inspectionId = toStringOrNull(body.inspectionId);
    const lineItemId = toStringOrNull(body.lineItemId);
    const inventoryRequestId = toStringOrNull(body.inventoryRequestId);
    const inventoryRequestItemId = toStringOrNull(body.inventoryRequestItemId);
    const isEstimate = !!lineItemId;
    const isInventory = !!inventoryRequestId && !!inventoryRequestItemId;

    if (!isEstimate && !isInventory) {
      return createMobileErrorResponse(
        "lineItemId or inventoryRequestId/inventoryRequestItemId required",
        400,
      );
    }

    const sql = getSql();
    if (isEstimate && lineItemId) {
      const existing = await sql`
        SELECT id
        FROM part_quotes
        WHERE company_id = ${companyId}
          AND vendor_id = ${vendorId}
          AND line_item_id = ${lineItemId}
        LIMIT 1
      `;
      if (existing.length) {
        return createMobileErrorResponse(
          "Quote already submitted for this part.",
          409,
        );
      }
    }

    if (isInventory) {
      const existing = await sql`
        SELECT id
        FROM part_quotes
        WHERE company_id = ${companyId}
          AND vendor_id = ${vendorId}
          AND inventory_request_item_id = ${inventoryRequestItemId}
        LIMIT 1
      `;
      if (existing.length) {
        return createMobileErrorResponse(
          "Quote already submitted for this part.",
          409,
        );
      }
    }

    if (isEstimate && lineItemId) {
      const verifyRows = await sql`
        SELECT li.id
        FROM line_items li
        WHERE li.id = ${lineItemId}
          AND li.company_id = ${companyId}
          AND (${inspectionId}::uuid IS NULL OR li.inspection_id = ${inspectionId})
        LIMIT 1
      `;
      if (!verifyRows.length) {
        return createMobileErrorResponse("Line item not found", 404);
      }
    }

    if (isInventory) {
      const verifyRows = await sql`
        SELECT iori.id
        FROM inventory_order_request_items iori
        INNER JOIN inventory_order_requests ior ON ior.id = iori.request_id
        WHERE iori.id = ${inventoryRequestItemId}
          AND ior.id = ${inventoryRequestId}
          AND ior.company_id = ${companyId}
        LIMIT 1
      `;
      if (!verifyRows.length) {
        return createMobileErrorResponse("Inventory request item not found", 404);
      }
    }

    const row = await sql`
      INSERT INTO part_quotes (
        company_id,
        vendor_id,
        estimate_id,
        estimate_item_id,
        line_item_id,
        inventory_request_id,
        inventory_request_item_id,
        part_number,
        remarks,
        oem,
        oe,
        aftm,
        used,
        oem_qty,
        oe_qty,
        aftm_qty,
        used_qty,
        oem_etd,
        oe_etd,
        aftm_etd,
        used_etd,
        oem_time,
        oe_time,
        aftm_time,
        used_time
      ) VALUES (
        ${companyId},
        ${vendorId},
        ${null},
        ${null},
        ${lineItemId ?? null},
        ${inventoryRequestId ?? null},
        ${inventoryRequestItemId ?? null},
        ${toStringOrNull(body.partNumber)},
        ${toStringOrNull(body.remarks)},
        ${toNumberOrNull(body.oemAmount)},
        ${toNumberOrNull(body.oeAmount)},
        ${toNumberOrNull(body.aftmAmount)},
        ${toNumberOrNull(body.usedAmount)},
        ${toNumberOrNull(body.oemQty)},
        ${toNumberOrNull(body.oeQty)},
        ${toNumberOrNull(body.aftmQty)},
        ${toNumberOrNull(body.usedQty)},
        ${toStringOrNull(body.oemEtd)},
        ${toStringOrNull(body.oeEtd)},
        ${toStringOrNull(body.aftmEtd)},
        ${toStringOrNull(body.usedEtd)},
        ${toStringOrNull(body.oemTime)},
        ${toStringOrNull(body.oeTime)},
        ${toStringOrNull(body.aftmTime)},
        ${toStringOrNull(body.usedTime)}
      )
      RETURNING id
    `;

    return createMobileSuccessResponse({ quote: row[0] ?? null }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/vendors/[vendorId]/part-quotes error:",
      error,
    );
    return handleMobileError(error);
  }
}

