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

  // Get invoice details
  const [invoice] = await sql<any[]>`
    SELECT id, grand_total, customer_id, status FROM invoices
    WHERE company_id = ${companyId} AND id = ${invoiceId}
  `;
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  const grandTotal = Number(invoice.grand_total ?? 0);
  const customerId = invoice.customer_id;

  // If paying via wallet, deduct from customer wallet
  if (paymentMethod === "wallet" && customerId && grandTotal > 0) {
    // Check wallet balance
    const [customer] = await sql<any[]>`SELECT wallet_amount FROM customers WHERE id = ${customerId}`;
    const walletBalance = Number(customer?.wallet_amount ?? 0);
    if (walletBalance < grandTotal) {
      return NextResponse.json({ error: `Insufficient wallet balance. Available: AED ${walletBalance.toFixed(2)}, Required: AED ${grandTotal.toFixed(2)}` }, { status: 400 });
    }

    // Deduct from wallet
    await sql`UPDATE customers SET wallet_amount = wallet_amount - ${grandTotal}, updated_at = now() WHERE id = ${customerId}`;

    // Create wallet transaction record
    await sql`
      INSERT INTO customer_wallet_transactions (company_id, customer_id, amount, type, payment_method, status, notes, approved_at, approved_by)
      VALUES (${companyId}, ${customerId}, ${-grandTotal}, 'debit', ${paymentMethod}, 'approved', ${'Payment for invoice ' + (invoice.invoice_number ?? invoiceId)}, now(), ${null})
    `.catch(() => {});
  }

  // Mark invoice as paid
  await sql`
    UPDATE invoices
    SET status = 'paid',
        payment_method = ${paymentMethod},
        paid_at = ${paidAt.toISOString()}
    WHERE company_id = ${companyId} AND id = ${invoiceId}
  `;

  return NextResponse.json({ data: { id: invoiceId, status: "paid", amountPaid: grandTotal } });
}
