import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const quoteId = String(body?.quoteId ?? "").trim();
  const ordered = body?.ordered ?? {};
  const orderedOem = ordered?.oemQty ?? body?.oemQty;
  const orderedOe = ordered?.oeQty ?? body?.oeQty;
  const orderedAftm = ordered?.aftmQty ?? body?.aftmQty;
  const orderedUsed = ordered?.usedQty ?? body?.usedQty;
  const toNum = (val: any) => {
    if (val === null || val === undefined || val === "") return 0;
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
  };
  const oemQty = toNum(orderedOem);
  const oeQty = toNum(orderedOe);
  const aftmQty = toNum(orderedAftm);
  const usedQty = toNum(orderedUsed);
  const anyQty = oemQty > 0 || oeQty > 0 || aftmQty > 0 || usedQty > 0;
  if (!companyId || !quoteId) {
    return NextResponse.json({ error: "companyId and quoteId are required" }, { status: 400 });
  }
  if (!anyQty) {
    return NextResponse.json({ error: "ordered_qty_required" }, { status: 400 });
  }

  const sql = getSql();
  const rowsExisting = await sql`
    SELECT
      pq.oem_qty,
      pq.oe_qty,
      pq.aftm_qty,
      pq.used_qty,
      li.customer_approval_status AS line_item_customer_approval_status,
      pq.estimate_id,
      e.status AS estimate_status,
      ior.estimate_id AS request_estimate_id,
      e_from_request.status AS request_estimate_status,
      e_from_inspection.status AS inspection_estimate_status,
      COALESCE(
        e.meta->'customerEstimateApproval'->>'status',
        e_from_request.meta->'customerEstimateApproval'->>'status',
        e_from_inspection.meta->'customerEstimateApproval'->>'status'
      ) AS customer_approval_status
    FROM part_quotes pq
    LEFT JOIN estimates e ON e.id = pq.estimate_id
    LEFT JOIN inventory_order_requests ior ON ior.id = pq.inventory_request_id
    LEFT JOIN estimates e_from_request ON e_from_request.id = ior.estimate_id
    LEFT JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN LATERAL (
      SELECT e2.status, e2.meta
      FROM estimates e2
      WHERE e2.company_id = pq.company_id
        AND (
          (li.inspection_id IS NOT NULL AND e2.inspection_id = li.inspection_id)
          OR (pq.estimate_id IS NOT NULL AND e2.id = pq.estimate_id)
          OR (ior.estimate_id IS NOT NULL AND e2.id = ior.estimate_id)
        )
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(e2.meta->'customerEstimateApproval'->>'status', '')) = 'approved' THEN 0
          WHEN LOWER(COALESCE(e2.status, '')) = 'approved' THEN 1
          ELSE 2
        END,
        e2.updated_at DESC
      LIMIT 1
    ) e_from_inspection ON TRUE
    WHERE pq.company_id = ${companyId} AND pq.id = ${quoteId}
    LIMIT 1
  `;
  if (!rowsExisting.length) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  const current = rowsExisting[0];
  const estimateStatus = String(current.estimate_status ?? "").trim().toLowerCase();
  const requestEstimateStatus = String(current.request_estimate_status ?? "").trim().toLowerCase();
  const inspectionEstimateStatus = String(current.inspection_estimate_status ?? "").trim().toLowerCase();
  const lineItemCustomerApprovalStatus = String(current.line_item_customer_approval_status ?? "").trim().toLowerCase();
  const customerApprovalStatus = String(current.customer_approval_status ?? "").trim().toLowerCase();
  const isCustomerApproved =
    lineItemCustomerApprovalStatus === "approved" ||
    customerApprovalStatus === "approved" ||
    estimateStatus === "approved" ||
    requestEstimateStatus === "approved" ||
    inspectionEstimateStatus === "approved";
  if (!isCustomerApproved) {
    return NextResponse.json(
      { error: "estimate_not_customer_approved" },
      { status: 409 }
    );
  }
  const maxOem = Number(current.oem_qty ?? 0);
  const maxOe = Number(current.oe_qty ?? 0);
  const maxAftm = Number(current.aftm_qty ?? 0);
  const maxUsed = Number(current.used_qty ?? 0);
  if ((oemQty && maxOem && oemQty > maxOem) || (oeQty && maxOe && oeQty > maxOe) || (aftmQty && maxAftm && aftmQty > maxAftm) || (usedQty && maxUsed && usedQty > maxUsed)) {
    return NextResponse.json({ error: "ordered_qty_exceeds_quote" }, { status: 400 });
  }
  const rows = await sql`
    UPDATE part_quotes
    SET status = ${"Ordered"},
        ordered_oem_qty = ${oemQty || null},
        ordered_oe_qty = ${oeQty || null},
        ordered_aftm_qty = ${aftmQty || null},
        ordered_used_qty = ${usedQty || null},
        updated_at = NOW()
    WHERE company_id = ${companyId} AND id = ${quoteId}
    RETURNING id, status
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: { id: rows[0].id, status: rows[0].status },
  });
}
