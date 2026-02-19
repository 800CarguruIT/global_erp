import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = {
  params: Promise<{ companyId: string; branchId: string; quoteId: string }>;
};

function mapWorkshopQuote(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    quoteType: "branch_labor",
    status: row.status,
    estimateId: row.estimate_id,
    workOrderId: null,
    vendorId: null,
    branchId: row.branch_id,
    currency: row.currency,
    totalAmount: Number(row.total_amount ?? 0),
    negotiatedAmount: row.negotiated_amount != null ? Number(row.negotiated_amount) : null,
    quotedAmount: row.quoted_amount != null ? Number(row.quoted_amount) : null,
    acceptedAmount: row.accepted_amount != null ? Number(row.accepted_amount) : null,
    additionalAmount: row.additional_amount != null ? Number(row.additional_amount) : 0,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    remarks: row.remarks ?? null,
    meta: row.meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, quoteId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const rows = await sql`
      SELECT *
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND branch_id = ${branchId}
        AND id = ${quoteId}
      LIMIT 1
    `;
    if (!rows.length) return createMobileErrorResponse("Not found", 404);
    return createMobileSuccessResponse({ quote: mapWorkshopQuote(rows[0]), items: [] });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/quotes/[quoteId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, quoteId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const body = await req.json().catch(() => ({}));

    const rows = await sql`
      SELECT *
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND branch_id = ${branchId}
        AND id = ${quoteId}
      LIMIT 1
    `;
    if (!rows.length) return createMobileErrorResponse("Not found", 404);
    const row = rows[0];

    const workflowAction = String(body.workflowAction ?? "").toLowerCase();
    if (workflowAction) {
      if (!["accepted", "negotiation", "rejected"].includes(workflowAction)) {
        return createMobileErrorResponse("Invalid workflow action.", 400);
      }
      const nextMeta = row.meta && typeof row.meta === "object" ? { ...row.meta } : {};

      if (workflowAction === "negotiation") {
        const negotiatedAmount = Number(body.negotiatedAmount);
        if (!Number.isFinite(negotiatedAmount) || negotiatedAmount <= 0) {
          return createMobileErrorResponse("Valid negotiatedAmount is required.", 400);
        }
        (nextMeta as any).negotiationPreviousAmount = Number(row.total_amount ?? 0);
        (nextMeta as any).negotiatedAmount = negotiatedAmount;
        (nextMeta as any).negotiationNote =
          typeof body.negotiationNote === "string" ? body.negotiationNote.trim() || null : null;
        await sql`
          UPDATE workshop_quotes
          SET status = 'negotiation',
              negotiated_amount = ${negotiatedAmount},
              total_amount = ${negotiatedAmount},
              meta = ${nextMeta},
              updated_at = NOW()
          WHERE id = ${quoteId}
            AND company_id = ${companyId}
            AND branch_id = ${branchId}
        `;
      }

      if (workflowAction === "accepted") {
        const acceptedAmount = Number(row.negotiated_amount ?? row.quoted_amount ?? row.total_amount ?? 0);
        await sql`
          UPDATE workshop_quotes
          SET status = 'accepted',
              accepted_amount = ${acceptedAmount},
              total_amount = ${acceptedAmount},
              approved_by = ${userId},
              approved_at = NOW(),
              updated_at = NOW()
          WHERE id = ${quoteId}
            AND company_id = ${companyId}
            AND branch_id = ${branchId}
        `;
        if (row.job_card_id) {
          await sql`
            UPDATE job_cards
            SET status = 'Pending',
                updated_at = NOW()
            WHERE id = ${row.job_card_id}
          `;
        }
      }

      if (workflowAction === "rejected") {
        (nextMeta as any).rejectionReason =
          typeof body.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;
        await sql`
          UPDATE workshop_quotes
          SET status = 'rejected',
              meta = ${nextMeta},
              updated_at = NOW()
          WHERE id = ${quoteId}
            AND company_id = ${companyId}
            AND branch_id = ${branchId}
        `;
        if (row.job_card_id) {
          await sql`
            UPDATE job_cards
            SET status = 'Re-Assigned',
                updated_at = NOW()
            WHERE id = ${row.job_card_id}
          `;
        }
      }
    } else {
      const requestedStatus =
        typeof body?.status === "string"
          ? body.status
          : typeof body?.header?.status === "string"
          ? body.header.status
          : "";
      const nextStatus = requestedStatus.toLowerCase();
      const item = Array.isArray(body?.items) ? body.items[0] : body?.item;
      const laborHours = Number(item?.laborHours ?? item?.quantity);
      const laborRate = Number(item?.laborRate ?? item?.unitPrice);
      const computedTotal =
        Number.isFinite(laborHours) && Number.isFinite(laborRate) && laborHours > 0 && laborRate >= 0
          ? laborHours * laborRate
          : null;
      const acceptedFromComputed = Number.isFinite(computedTotal) ? Number(computedTotal) : null;

      if (["pending", "accepted", "negotiation", "rejected", "cancelled", "verified"].includes(nextStatus)) {
        await sql`
          UPDATE workshop_quotes
          SET status = ${nextStatus},
              total_amount = COALESCE(${computedTotal}, total_amount),
              quoted_amount = COALESCE(${computedTotal}, quoted_amount),
              accepted_amount = CASE
                WHEN ${nextStatus} = 'accepted'
                  THEN COALESCE(${acceptedFromComputed}, negotiated_amount, quoted_amount, total_amount)
                ELSE accepted_amount
              END,
              eta_hours = COALESCE(${Number.isFinite(laborHours) ? laborHours : null}, eta_hours),
              meta = CASE
                WHEN ${Number.isFinite(laborRate)} THEN COALESCE(meta, '{}'::jsonb) || jsonb_build_object('laborRate', ${laborRate})
                ELSE meta
              END,
              updated_at = NOW()
          WHERE id = ${quoteId}
            AND company_id = ${companyId}
            AND branch_id = ${branchId}
        `;
      } else if (computedTotal != null || Number.isFinite(laborHours) || Number.isFinite(laborRate)) {
        await sql`
          UPDATE workshop_quotes
          SET total_amount = COALESCE(${computedTotal}, total_amount),
              quoted_amount = COALESCE(${computedTotal}, quoted_amount),
              eta_hours = COALESCE(${Number.isFinite(laborHours) ? laborHours : null}, eta_hours),
              meta = CASE
                WHEN ${Number.isFinite(laborRate)} THEN COALESCE(meta, '{}'::jsonb) || jsonb_build_object('laborRate', ${laborRate})
                ELSE meta
              END,
              updated_at = NOW()
          WHERE id = ${quoteId}
            AND company_id = ${companyId}
            AND branch_id = ${branchId}
        `;
      }
    }

    const refreshed = await sql`
      SELECT *
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND branch_id = ${branchId}
        AND id = ${quoteId}
      LIMIT 1
    `;
    if (!refreshed.length) return createMobileErrorResponse("Not found", 404);
    return createMobileSuccessResponse({ quote: mapWorkshopQuote(refreshed[0]), items: [] });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/branches/[branchId]/workshop/quotes/[quoteId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
