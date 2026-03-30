import { NextRequest, NextResponse } from "next/server";
import { createInvoiceFromEstimate, createInvoiceFromQualityCheck, listInvoicesForCompany } from "@repo/ai-core/workshop/invoices/repository";
import type { InvoiceStatus } from "@repo/ai-core/workshop/invoices/types";
import type { GatepassHandoverType } from "@repo/ai-core/workshop/gatepass/types";
import { createGatepassFromInvoice } from "@repo/ai-core/workshop/gatepass/repository";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InvoiceStatus | null;
  const data = await listInvoicesForCompany(companyId, { status: status ?? undefined });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.qcId && !body.estimateId) {
      return new NextResponse("qcId or estimateId required", { status: 400 });
    }
    const result = body.estimateId
      ? await createInvoiceFromEstimate(companyId, body.estimateId)
      : await createInvoiceFromQualityCheck(companyId, body.qcId);
    const sql = getSql();

    // Add service charges as invoice line items
    const sc = body.serviceCharges;
    if (sc && result.invoice.id) {
      const invoiceId = result.invoice.id;
      const vatRate = Number(result.invoice.vatRate ?? 5);
      const charges: Array<{ name: string; amount: number }> = [];
      if (Number(sc.inspectionFee ?? 0) > 0) charges.push({ name: "Inspection Fee", amount: Number(sc.inspectionFee) });
      if (Number(sc.recoveryPickupFee ?? 0) > 0) charges.push({ name: "Recovery Pickup Fee", amount: Number(sc.recoveryPickupFee) });
      if (Number(sc.recoveryDropoffFee ?? 0) > 0) charges.push({ name: "Recovery Dropoff Fee", amount: Number(sc.recoveryDropoffFee) });
      if (Number(sc.labourCharge ?? 0) > 0) charges.push({ name: "Labour Charge", amount: Number(sc.labourCharge) });
      if (charges.length > 0) {
        const maxLineNo = await sql`SELECT COALESCE(MAX(line_no), 0)::int as max_line FROM invoice_items WHERE invoice_id = ${invoiceId}`;
        let nextLine = Number(maxLineNo[0]?.max_line ?? 0) + 1;
        for (const charge of charges) {
          await sql`
            INSERT INTO invoice_items (invoice_id, line_no, name, description, quantity, rate, line_sale, line_discount, line_final)
            VALUES (${invoiceId}, ${nextLine}, ${charge.name}, ${'Service charge'}, 1, ${charge.amount}, ${charge.amount}, 0, ${charge.amount})
          `;
          nextLine++;
        }
        // Recalculate invoice totals
        const serviceTotal = charges.reduce((s, c) => s + c.amount, 0);
        const currentTotals = await sql`SELECT total_sale, total_discount, final_amount, vat_rate, vat_amount, grand_total FROM invoices WHERE id = ${invoiceId}`;
        const cur = currentTotals[0];
        const newTotalSale = Number(cur?.total_sale ?? 0) + serviceTotal;
        const newFinalAmount = Number(cur?.final_amount ?? 0) + serviceTotal;
        const curVatRate = Number(cur?.vat_rate ?? vatRate);
        const newVat = Number((newFinalAmount * curVatRate / 100).toFixed(2));
        const newGrandTotal = Number((newFinalAmount + newVat).toFixed(2));
        await sql`
          UPDATE invoices SET total_sale = ${newTotalSale}, final_amount = ${newFinalAmount}, vat_amount = ${newVat}, grand_total = ${newGrandTotal}, updated_at = now()
          WHERE id = ${invoiceId}
        `;
        (result.invoice as any).grandTotal = newGrandTotal;
        (result.invoice as any).totalSale = newTotalSale;
        (result.invoice as any).finalAmount = newFinalAmount;
        (result.invoice as any).vatAmount = newVat;
      }
    }

    const grandTotal = Number(result.invoice.grandTotal ?? 0) || 0;
    const customerId = String(result.invoice.customerId ?? "").trim() || null;
    const autoSettleEnabled = Boolean(body.autoSettleOnConvert);
    const autoCarOutEnabled = Boolean(body.autoCarOutOnAutoPaid);
    let walletBalance = 0;
    let autoPaid = false;
    let autoPaidReason: "wallet" | "zero_balance" | "insufficient_wallet" | "disabled" = "disabled";

    if (autoSettleEnabled) {
      if (grandTotal <= 0) {
        await sql`
          UPDATE invoices
          SET status = 'paid',
              payment_method = 'zero_balance',
              paid_at = NOW(),
              notes = COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE E'\n' END || 'Auto-paid: zero balance invoice'
          WHERE company_id = ${companyId}
            AND id = ${result.invoice.id}
        `;
        autoPaid = true;
        autoPaidReason = "zero_balance";
      } else if (customerId) {
        const walletRows = await sql`
          SELECT wallet_amount
          FROM customers
          WHERE company_id = ${companyId}
            AND id = ${customerId}
          LIMIT 1
        `;
        walletBalance = Number(walletRows[0]?.wallet_amount ?? 0) || 0;
        if (walletBalance + 1e-9 >= grandTotal) {
          const nextBalance = Number((walletBalance - grandTotal).toFixed(2));
          await sql.begin(async (trx) => {
            await trx`
              UPDATE customers
              SET wallet_amount = ${nextBalance},
                  updated_at = NOW()
              WHERE company_id = ${companyId}
                AND id = ${customerId}
            `;
            await trx`
              INSERT INTO customer_wallet_transactions (
                company_id,
                customer_id,
                amount,
                payment_method,
                payment_date,
                payment_proof_file_id,
                approved_at,
                approved_by,
                notes
              ) VALUES (
                ${companyId},
                ${customerId},
                ${-grandTotal},
                ${"wallet"},
                ${new Date().toISOString().slice(0, 10)},
                ${null},
                NOW(),
                ${null},
                ${`Auto debit for invoice ${result.invoice.invoiceNumber}`}
              )
            `;
            await trx`
              UPDATE invoices
              SET status = 'paid',
                  payment_method = 'wallet',
                  paid_at = NOW(),
                  notes = COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE E'\n' END || 'Auto-paid from customer wallet'
              WHERE company_id = ${companyId}
                AND id = ${result.invoice.id}
            `;
          });
          walletBalance = nextBalance;
          autoPaid = true;
          autoPaidReason = "wallet";
        } else {
          autoPaidReason = "insufficient_wallet";
        }
      } else {
        autoPaidReason = "insufficient_wallet";
      }
    }

    let gatepassId: string | null = null;
    const shouldAutoCarOut = Boolean(autoCarOutEnabled && autoPaid);
    if (shouldAutoCarOut && result?.invoice?.id) {
      const handoverType = (body.handoverType as GatepassHandoverType) ?? "branch";
      try {
        const gatepass = await createGatepassFromInvoice(companyId, result.invoice.id, handoverType);
        gatepassId = String(gatepass?.id ?? "") || null;
      } catch {
        gatepassId = null;
      }
    }
    // Optionally auto-create gatepass when invoice created
    const invoiceRows = await sql`
      SELECT status, paid_at, payment_method
      FROM invoices
      WHERE company_id = ${companyId}
        AND id = ${result.invoice.id}
      LIMIT 1
    `;
    const invoiceStatus = String(invoiceRows[0]?.status ?? result.invoice.status ?? "draft");
    return NextResponse.json(
      {
        data: {
          ...result,
          invoice: {
            ...result.invoice,
            status: invoiceStatus,
            paidAt: invoiceRows[0]?.paid_at ?? result.invoice.paidAt ?? null,
            paymentMethod: invoiceRows[0]?.payment_method ?? result.invoice.paymentMethod ?? null,
          },
          autoSettlement: {
            enabled: autoSettleEnabled,
            autoPaid,
            reason: autoPaidReason,
            walletBalance,
          },
          carOut: {
            requested: shouldAutoCarOut,
            gatepassId,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    const message = error?.message ?? "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
