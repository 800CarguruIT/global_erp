import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { Crm, Files } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

type ParamsCtx =
  | { params: { id: string; transactionId: string } }
  | { params: Promise<{ id: string; transactionId: string }> };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildProformaHtml(payload: {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  companyLogo?: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  txnId: string;
  date: string;
  status: string;
  mode: string;
  amount: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Proforma Invoice</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      .title { background: #111; color: #fff; text-align: center; letter-spacing: 6px; padding: 10px 12px; font-weight: 700; border-radius: 6px; }
      .header { display: flex; justify-content: space-between; margin-top: 16px; }
      .company { font-size: 12px; line-height: 1.5; }
      .logo { width: 110px; height: 110px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #555; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
      .field-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 6px; font-size: 12px; }
      .label { background: #d9d9d9; padding: 4px 6px; border-radius: 4px; }
      .value { border: 1px solid #d9d9d9; padding: 4px 6px; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
      th, td { border: 1px solid #cfcfcf; padding: 6px 8px; text-align: left; }
      th { background: #d9d9d9; }
      .note { margin-top: 8px; font-size: 12px; border: 1px solid #cfcfcf; padding: 6px 8px; border-radius: 4px; }
      .totals { display: flex; justify-content: flex-end; margin-top: 8px; }
      .totals .box { border: 1px solid #cfcfcf; padding: 8px 10px; min-width: 180px; }
      .terms { margin-top: 28px; font-size: 11px; }
    </style>
  </head>
  <body>
    <div class="title">PROFORMA INVOICE</div>
    <div class="header">
      <div class="company">
        <div><strong>${escapeHtml(payload.companyName)}</strong></div>
        <div>${escapeHtml(payload.companyAddress)}</div>
        <div>Call: ${escapeHtml(payload.companyPhone)}</div>
        <div>Email: ${escapeHtml(payload.companyEmail)}</div>
      </div>
      ${
        payload.companyLogo
          ? `<img class="logo" src="${payload.companyLogo}" alt="Company logo" />`
          : `<div class="logo">LOGO</div>`
      }
    </div>
    <div class="grid">
      <div>
        <div class="field-row"><div class="label">Customer ID</div><div class="value">${escapeHtml(payload.customerId)}</div></div>
        <div class="field-row"><div class="label">Customer Name</div><div class="value">${escapeHtml(payload.customerName)}</div></div>
        <div class="field-row"><div class="label">Customer Phone</div><div class="value">${escapeHtml(payload.customerPhone)}</div></div>
      </div>
      <div>
        <div class="field-row"><div class="label">TXN #</div><div class="value">${escapeHtml(payload.txnId)}</div></div>
        <div class="field-row"><div class="label">Date</div><div class="value">${escapeHtml(payload.date)}</div></div>
        <div class="field-row"><div class="label">Status</div><div class="value">${escapeHtml(payload.status)}</div></div>
        <div class="field-row"><div class="label">Mode</div><div class="value">${escapeHtml(payload.mode)}</div></div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Description</th>
          <th>Paid Amount</th>
          <th>Rate</th>
          <th>Points Received</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Guru Coins</td>
          <td>Customer E-Wallet</td>
          <td>AED ${payload.amount}</td>
          <td>1</td>
          <td>${payload.amount}</td>
        </tr>
      </tbody>
    </table>
    <div class="note"><strong>Note:</strong> 1 Guru Coin = 1 AED</div>
    <div class="totals">
      <div class="box"><strong>Points Purchased</strong><div style="font-size: 16px; margin-top: 4px;">${payload.amount}</div></div>
    </div>
    <div class="terms">
      <div><strong>Terms & Conditions</strong></div>
      <ol>
        <li>All products and services are non-refundable.</li>
        <li>Product warranty will be as per manufacturer's policy.</li>
        <li>This is system generated; no signature required.</li>
      </ol>
    </div>
  </body>
</html>`;
}

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  let browser: any;
  try {
    const { id, transactionId } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const customer = await Crm.getCustomerWithCars(id);
    if (!customer || customer.company_id !== companyId) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const txn = await Crm.getCustomerWalletTransaction(transactionId);
    if (!txn || txn.company_id !== companyId || txn.customer_id !== id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyName =
      (company as any).display_name || (company as any).legal_name || "Company";
    const companyPhone = (company as any).company_phone || "-";
    const companyEmail = (company as any).company_email || "-";
    const companyAddress =
      (company as any).address_line1 ||
      (company as any).address_line2 ||
      (company as any).city ||
      "-";
    const logoFileId = (company as any).logo_file_id ?? null;
    let companyLogo: string | null = null;
    if (logoFileId) {
      try {
        const record = await Files.getFileById(logoFileId);
        const storagePath = (record as any)?.storage_path ?? (record as any)?.storagePath;
        const mimeType = (record as any)?.mime_type ?? (record as any)?.mimeType ?? "image/png";
        if (storagePath) {
          const data = await fs.readFile(storagePath);
          const base64 = Buffer.from(data).toString("base64");
          companyLogo = `data:${mimeType};base64,${base64}`;
        }
      } catch {
        companyLogo = null;
      }
    }

    const html = buildProformaHtml({
      companyName: String(companyName),
      companyPhone: String(companyPhone),
      companyEmail: String(companyEmail),
      companyAddress: String(companyAddress),
      companyLogo,
      customerId: String((customer as any).code ?? id),
      customerName: String(customer.name ?? "Customer"),
      customerPhone: String(customer.phone ?? "-"),
      txnId: String(txn.id),
      date: formatDateOnly(txn.payment_date ?? txn.created_at ?? null),
      status: txn.approved_at ? "Paid" : "Unapproved",
      mode: String(txn.payment_method ?? "-"),
      amount: Number(txn.amount ?? 0).toFixed(2),
    });

    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await page.close();
    await browser.close();

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proforma-${txn.id}.pdf"`,
      },
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    console.error("GET /api/customers/[id]/wallet/transactions/[transactionId]/proforma error:", error);
    return NextResponse.json({ error: "Failed to generate proforma" }, { status: 500 });
  }
}
