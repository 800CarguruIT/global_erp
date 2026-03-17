import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { receivePoItems } from "@repo/ai-core/workshop/procurement/repository";
import { getUserContext } from "@/lib/auth/user-context";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = {
  params: Promise<{ companyId: string; jobCardId: string; lineItemId: string }>;
};

function normalizeText(value: unknown): string | null {
  const out = String(value ?? "").trim();
  return out || null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, jobCardId, lineItemId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    const partPic = body?.partPic ?? undefined;
    const scrapPic = body?.scrapPic ?? undefined;
    const receiveStatusRaw = body?.receiveStatus ?? undefined;
    const requestedQtyRaw = Number(body?.quantity ?? body?.receivedQty ?? 0);

    if (partPic === undefined && scrapPic === undefined && receiveStatusRaw === undefined) {
      return createMobileErrorResponse("No updates provided", 400);
    }

    const normalizedReceiveStatus =
      receiveStatusRaw === undefined
        ? null
        : String(receiveStatusRaw)
            .trim()
            .toLowerCase();
    const receiveStatusMap = new Map<string, "Ordered" | "Received" | "Returned" | "Partially Received">([
      ["ordered", "Ordered"],
      ["received", "Received"],
      ["return", "Returned"],
      ["returned", "Returned"],
      ["partially received", "Partially Received"],
      ["partially_received", "Partially Received"],
      ["partial", "Partially Received"],
    ]);
    const normalizedReceiveStatusLabel =
      normalizedReceiveStatus === null ? null : receiveStatusMap.get(normalizedReceiveStatus) ?? null;
    if (receiveStatusRaw !== undefined && !normalizedReceiveStatusLabel) {
      return createMobileErrorResponse("Invalid receive status", 400);
    }

    const sql = getSql();
    const currentUserContext = await getUserContext(userId);
    if (currentUserContext.scope === "branch") {
      const currentUserBranchId = currentUserContext.companies[0]?.branchId ?? null;
      const jobCardRows = await sql`
        SELECT l.branch_id AS lead_branch_id
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = e.lead_id
        WHERE jc.id = ${jobCardId} AND e.company_id = ${companyId}
        LIMIT 1
      `;
      if (!jobCardRows.length) return createMobileErrorResponse("Not found", 404);
      const assignedBranchId = jobCardRows[0]?.lead_branch_id ?? null;
      if (!currentUserBranchId || !assignedBranchId || currentUserBranchId !== assignedBranchId) {
        return createMobileErrorResponse("Only assigned workshop can perform this action.", 403);
      }
    }

    const currentRows = await sql`
      SELECT id, quantity, part_pic, scrap_pic, order_status
      FROM line_items
      WHERE id = ${lineItemId}
        AND job_card_id = ${jobCardId}
        AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!currentRows.length) {
      return createMobileErrorResponse("Not found", 404);
    }
    const current = currentRows[0];
    const nextPartPic = normalizeText(partPic) ?? normalizeText(current?.part_pic);
    const nextScrapPic = normalizeText(scrapPic) ?? normalizeText(current?.scrap_pic);

    if (normalizedReceiveStatusLabel === "Received" && !nextPartPic) {
      return createMobileErrorResponse("Part picture is required before marking as received.", 400);
    }
    if (normalizedReceiveStatusLabel === "Partially Received" && !nextPartPic) {
      return createMobileErrorResponse("Part picture is required before marking as partially received.", 400);
    }
    if (normalizedReceiveStatusLabel === "Returned" && !nextPartPic) {
      return createMobileErrorResponse("Upload part picture evidence before marking as return.", 400);
    }
    if (normalizedReceiveStatusLabel === "Partially Received" && (!Number.isFinite(requestedQtyRaw) || requestedQtyRaw <= 0)) {
      return createMobileErrorResponse("Enter received quantity for partially received status.", 400);
    }
    if (normalizedReceiveStatusLabel === "Returned" && (!Number.isFinite(requestedQtyRaw) || requestedQtyRaw <= 0)) {
      return createMobileErrorResponse("Enter return quantity for return status.", 400);
    }

    const rows = await sql`
      UPDATE line_items
      SET
        part_pic = COALESCE(${partPic ?? null}, part_pic),
        scrap_pic = COALESCE(${scrapPic ?? null}, scrap_pic)
      WHERE id = ${lineItemId}
        AND job_card_id = ${jobCardId}
        AND company_id = ${companyId}
      RETURNING id, part_pic, scrap_pic, order_status
    `;
    if (!rows.length) {
      return createMobileErrorResponse("Not found", 404);
    }

    let procurementSummary: any = null;
    if (normalizedReceiveStatusLabel) {
      const poLinkRows = await sql`
        SELECT
          poi.id AS po_item_id,
          poi.purchase_order_id AS po_id,
          poi.quantity AS po_qty,
          poi.received_qty AS po_received_qty
        FROM line_items li
        LEFT JOIN part_quotes pq
          ON pq.company_id = ${companyId}
         AND pq.line_item_id = li.id
        INNER JOIN purchase_order_items poi
          ON (
            poi.estimate_item_id = li.id
            OR poi.quote_id = pq.id
            OR (
              poi.estimate_item_id IS NOT NULL
              AND pq.estimate_item_id IS NOT NULL
              AND poi.estimate_item_id = pq.estimate_item_id
            )
          )
        INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE li.company_id = ${companyId}
          AND li.id = ${lineItemId}
        ORDER BY
          CASE
            WHEN LOWER(COALESCE(po.status, '')) = 'issued' THEN 0
            WHEN LOWER(COALESCE(po.status, '')) = 'partially_received' THEN 1
            WHEN LOWER(COALESCE(po.status, '')) = 'received' THEN 2
            ELSE 3
          END,
          po.updated_at DESC
        LIMIT 1
      `;

      if (!poLinkRows.length) {
        return createMobileErrorResponse(
          "This part is not linked to procurement purchase order yet. Please order/link the part in procurement first.",
          409,
        );
      }

      const poLink = poLinkRows[0];
      const poQty = Math.max(0, Number(poLink.po_qty ?? current?.quantity ?? 0));
      const poReceived = Math.max(0, Number(poLink.po_received_qty ?? 0));
      const remaining = Math.max(poQty - poReceived, 0);
      const normalizedRequestedQty = Number.isFinite(requestedQtyRaw) && requestedQtyRaw > 0 ? requestedQtyRaw : 0;
      const qtyToApply =
        normalizedReceiveStatusLabel === "Received"
          ? remaining > 0
            ? remaining
            : normalizedRequestedQty
          : normalizedReceiveStatusLabel === "Partially Received"
            ? Math.max(1, remaining > 1 ? Math.min(normalizedRequestedQty || 1, remaining - 1) : 1)
            : normalizedRequestedQty;

      const action =
        normalizedReceiveStatusLabel === "Returned"
          ? "return"
          : normalizedReceiveStatusLabel === "Partially Received"
            ? "partial"
            : "received";

      if (normalizedReceiveStatusLabel === "Received" && qtyToApply <= 0) {
        return createMobileErrorResponse("No remaining quantity to receive for this part.", 400);
      }

      let procurementResult: Awaited<ReturnType<typeof receivePoItems>> | null = null;
      try {
        procurementResult = await receivePoItems(
          companyId,
          String(poLink.po_id),
          [
            {
              itemId: String(poLink.po_item_id),
              quantity: qtyToApply,
              action,
            },
          ],
          userId,
        );
      } catch (error: any) {
        return createMobileErrorResponse(
          error?.message ?? "Failed to sync receive status with procurement flow.",
          400,
        );
      }

      const updatedPoItem =
        procurementResult?.items?.find((item) => String(item.id) === String(poLink.po_item_id)) ?? null;
      const poStatus = procurementResult?.po?.status ?? null;
      const latestGrnForPo = procurementResult?.grns?.[0] ?? null;
      const nextLineOrderStatus =
        String(updatedPoItem?.status ?? "").toLowerCase() === "received"
          ? "Received"
          : String(updatedPoItem?.status ?? "").toLowerCase() === "return"
            ? "Returned"
            : "Ordered";

      await sql`
        UPDATE line_items
        SET
          part_ordered = 1,
          order_status = ${nextLineOrderStatus},
          updated_at = NOW()
        WHERE company_id = ${companyId}
          AND id = ${lineItemId}
      `;

      const accountingRows = await sql`
        SELECT 1
        FROM accounting_journals
        WHERE company_id = ${companyId}
          AND journal_no LIKE ${`GRN-${String(poLink.po_id)}-${String(poLink.po_item_id)}-%`}
        LIMIT 1
      `;

      try {
        await sql`
          INSERT INTO job_card_part_receipt_logs (
            company_id,
            job_card_id,
            line_item_id,
            purchase_order_id,
            purchase_order_item_id,
            action,
            quantity,
            before_status,
            after_status,
            part_pic,
            actor_user_id
          ) VALUES (
            ${companyId},
            ${jobCardId},
            ${lineItemId},
            ${String(poLink.po_id)},
            ${String(poLink.po_item_id)},
            ${action},
            ${Number(qtyToApply ?? 0)},
            ${String(current?.order_status ?? "") || null},
            ${String(updatedPoItem?.status ?? normalizedReceiveStatusLabel ?? "") || null},
            ${nextPartPic},
            ${userId}
          )
        `;
      } catch {
        // ignore until migration exists everywhere
      }

      procurementSummary = {
        linked: true,
        poId: String(poLink.po_id),
        poItemId: String(poLink.po_item_id),
        poStatus,
        poItemStatus: updatedPoItem?.status ?? null,
        poItemOrderedQty: Number(updatedPoItem?.quantity ?? poLink.po_qty ?? 0),
        poItemReceivedQty: Number(updatedPoItem?.receivedQty ?? poLink.po_received_qty ?? 0),
        latestGrnNumber: latestGrnForPo?.grnNumber ?? null,
        inventoryMoved: Boolean(updatedPoItem?.movedToInventory),
        accountingPosted: accountingRows.length > 0,
      };
    }

    const latestRows = await sql`
      SELECT id, part_pic, scrap_pic, order_status
      FROM line_items
      WHERE id = ${lineItemId}
        AND job_card_id = ${jobCardId}
        AND company_id = ${companyId}
      LIMIT 1
    `;
    const latest = latestRows[0] ?? rows[0];

    return createMobileSuccessResponse({
      ...latest,
      receive_status: normalizedReceiveStatusLabel ?? latest?.order_status ?? null,
      procurement: procurementSummary,
    });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/workshop/job-cards/[jobCardId]/line-items/[lineItemId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
