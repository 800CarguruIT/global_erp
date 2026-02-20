import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

// List / Create quotes
export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  try {
    const sql = getSql();
    const workshopRows = await sql`
      SELECT
        wq.id,
        wq.company_id,
        'branch_labor'::text AS quote_type,
        wq.status,
        wq.estimate_id,
        NULL::uuid AS work_order_id,
        NULL::uuid AS vendor_id,
        wq.branch_id,
        wq.currency,
        wq.total_amount,
        wq.negotiated_amount,
        wq.quoted_amount,
        wq.accepted_amount,
        wq.additional_amount,
        NULL::date AS valid_until,
        wq.created_by,
        wq.approved_by,
        wq.approved_at,
        wq.meta,
        wq.created_at,
        wq.updated_at
      FROM workshop_quotes wq
      WHERE wq.company_id = ${companyId}
    `;
    const workshopQuotes = workshopRows.map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      quoteType: row.quote_type,
      status: row.status,
      estimateId: row.estimate_id,
      workOrderId: row.work_order_id,
      vendorId: row.vendor_id,
      branchId: row.branch_id,
      currency: row.currency,
      totalAmount: Number(row.total_amount ?? 0),
      negotiatedAmount: row.negotiated_amount != null ? Number(row.negotiated_amount) : null,
      quotedAmount: row.quoted_amount != null ? Number(row.quoted_amount) : null,
      acceptedAmount: row.accepted_amount != null ? Number(row.accepted_amount) : null,
      additionalAmount: row.additional_amount != null ? Number(row.additional_amount) : 0,
      validUntil: row.valid_until,
      createdBy: row.created_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      meta: row.meta,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const normalizedType = String(type ?? "").toLowerCase();
    const normalizedStatus = String(status ?? "").toLowerCase();
    const workshopFiltered = workshopQuotes.filter((quote: any) => {
      if (normalizedType && normalizedType !== "branch_labor") return false;
      if (normalizedStatus && String(quote.status ?? "").toLowerCase() !== normalizedStatus) return false;
      return true;
    });
    const data = workshopFiltered.sort(
      (a: any, b: any) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET quotes failed", err);
    return NextResponse.json(
      { error: "Failed to load quotes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.type as "vendor_part" | "branch_labor";
    if (mode === "vendor_part") {
      return NextResponse.json(
        { error: "vendor_part is not supported by this endpoint" },
        { status: 400 },
      );
    }
    if (mode === "branch_labor") {
      if (!body.estimateId || !body.branchId) {
        return NextResponse.json(
          { error: "estimateId and branchId are required for branch_labor" },
          { status: 400 },
        );
      }
      const sql = getSql();
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
          ${body.branchId},
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
          ${null}
        )
        RETURNING *
      `;
      const row = inserted[0];
      const data = {
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
          validUntil: null,
          createdBy: row.created_by,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          meta: row.meta,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        items: [],
      };
      return NextResponse.json({ data }, { status: 201 });
    }
    return NextResponse.json(
      { error: "Unknown quote type" },
      { status: 400 },
    );
  } catch (err) {
    console.error("POST quotes failed", err);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 },
    );
  }
}
