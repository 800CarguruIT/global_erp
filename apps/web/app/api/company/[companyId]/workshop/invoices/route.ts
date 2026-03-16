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
