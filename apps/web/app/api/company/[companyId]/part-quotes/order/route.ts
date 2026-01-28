import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const quoteId = String(body?.quoteId ?? "").trim();
  if (!companyId || !quoteId) {
    return NextResponse.json({ error: "companyId and quoteId are required" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE part_quotes
    SET status = ${"Ordered"},
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
