import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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
    SELECT oem_qty, oe_qty, aftm_qty, used_qty
    FROM part_quotes
    WHERE company_id = ${companyId} AND id = ${quoteId}
    LIMIT 1
  `;
  if (!rowsExisting.length) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  const current = rowsExisting[0];
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
