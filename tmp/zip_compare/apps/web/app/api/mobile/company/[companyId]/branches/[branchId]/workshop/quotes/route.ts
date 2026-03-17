import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; branchId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const branchRows = await sql`
      SELECT id
      FROM branches
      WHERE id = ${branchId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!branchRows[0]) {
      return createMobileErrorResponse("Branch not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const quoteType = searchParams.get("quoteType") ?? searchParams.get("type");
    const normalizedQuoteType = (quoteType ?? "").trim().toLowerCase();

    if (normalizedQuoteType && normalizedQuoteType !== "branch_labor") {
      return createMobileSuccessResponse({ quotes: [] });
    }

    const quotes = await sql`
      SELECT
        id,
        company_id,
        estimate_id,
        lead_id,
        branch_id,
        'branch_labor'::text AS quote_type,
        status,
        currency,
        total_amount,
        quoted_amount,
        accepted_amount,
        additional_amount,
        eta_preset,
        eta_hours,
        remarks,
        meta,
        created_at,
        updated_at
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND branch_id = ${branchId}
        ${status ? sql`AND status = ${status}` : sql``}
      ORDER BY updated_at DESC
    `;

    return createMobileSuccessResponse({ quotes });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/quotes error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const branchRows = await sql`
      SELECT id
      FROM branches
      WHERE id = ${branchId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!branchRows[0]) {
      return createMobileErrorResponse("Branch not found", 404);
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.type ?? "branch_labor").toLowerCase();
    if (mode !== "branch_labor") {
      return createMobileErrorResponse("Only branch_labor is allowed in branch workshop quotes endpoint", 400);
    }
    if (!body.estimateId) {
      return createMobileErrorResponse("estimateId is required for branch_labor", 400);
    }

    const inserted = await sql`
      INSERT INTO workshop_quotes (
        company_id,
        estimate_id,
        job_card_id,
        lead_id,
        branch_id,
        status,
        currency,
        total_amount,
        quoted_amount,
        accepted_amount,
        additional_amount,
        eta_preset,
        eta_hours,
        remarks,
        meta,
        created_by
      )
      VALUES (
        ${companyId},
        ${body.estimateId},
        ${body.jobCardId ?? null},
        ${body.leadId ?? null},
        ${branchId},
        'pending',
        ${body.currency ?? "AED"},
        ${Number(body.totalAmount ?? 0)},
        ${Number(body.totalAmount ?? 0)},
        ${null},
        ${0},
        ${body.etaPreset ?? null},
        ${body.etaHours ?? null},
        ${body.remarks ?? null},
        ${body.meta ?? null},
        ${userId}
      )
      RETURNING *
    `;
    const row = inserted[0];
    return createMobileSuccessResponse(
      {
        quote: {
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
          quotedAmount: row.quoted_amount != null ? Number(row.quoted_amount) : null,
          acceptedAmount: row.accepted_amount != null ? Number(row.accepted_amount) : null,
          additionalAmount: row.additional_amount != null ? Number(row.additional_amount) : 0,
          createdBy: row.created_by,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          meta: row.meta,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        items: [],
      },
      201,
    );
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/branches/[branchId]/workshop/quotes error:",
      error,
    );
    return handleMobileError(error);
  }
}
