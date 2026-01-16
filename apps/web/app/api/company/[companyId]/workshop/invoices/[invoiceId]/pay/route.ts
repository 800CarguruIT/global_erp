import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; invoiceId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, invoiceId } = await params;
  const body = await req.json().catch(() => ({}));
  const paymentMethod = body?.paymentMethod ?? null;
  const paymentDate = body?.paymentDate ?? null;

  const paidAt = paymentDate ? new Date(paymentDate) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE invoices
    SET status = 'paid',
        payment_method = ${paymentMethod},
        paid_at = ${paidAt.toISOString()}
    WHERE company_id = ${companyId} AND id = ${invoiceId}
    RETURNING id
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id: invoiceId, status: "paid" } });
}
