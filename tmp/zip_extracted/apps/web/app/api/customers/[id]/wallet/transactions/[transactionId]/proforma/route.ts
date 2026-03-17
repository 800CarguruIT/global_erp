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

function formatMoney(value: number) {
  return `AED ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))}`;
}

function buildProformaHtml(payload: {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  companyTrn: string;
  companyLogo?: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  txnId: string;
  txnRef: string;
  date: string;
  status: string;
  mode: string;
  amount: string;
  collectedBy: string;
  generatedAt: string;
}) {
  const isApproved = payload.status.toLowerCase() === "paid";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Wallet Proforma</title>
    <style>
      @page { size: A4; margin: 18mm 14mm; }
      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        color: #111827;
        margin: 0;
        font-size: 12px;
      }
      .sheet { width: 100%; }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
      }
      .brand {
        flex: 1;
        padding: 14px 16px 10px 16px;
        background: #ffffff;
        color: #0f172a;
      }
      .brand h1 {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.3px;
      }
      .brand p {
        margin: 5px 0 0;
        color: #475569;
        line-height: 1.45;
      }
      .brand .company {
        margin-top: 6px;
        font-weight: 700;
        color: #0f172a;
      }
      .meta {
        width: 235px;
        border-left: 1px solid #e5e7eb;
        background: #ffffff;
        padding: 12px 14px;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px dashed #e5e7eb;
      }
      .meta-row:last-child { border-bottom: 0; }
      .meta-key { color: #64748b; font-weight: 600; }
      .meta-val { font-weight: 700; color: #111827; }
      .status-chip {
        display: inline-block;
        margin-top: 8px;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.4px;
        border: 1px solid ${isApproved ? "#059669" : "#d97706"};
        color: ${isApproved ? "#065f46" : "#92400e"};
        background: ${isApproved ? "#d1fae5" : "#fef3c7"};
      }
      .logo-box {
        width: 96px;
        height: 96px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .logo-box img { width: 100%; height: 100%; object-fit: contain; }
      .cards {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .card {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px;
      }
      .card h3 {
        margin: 0 0 8px;
        font-size: 12px;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .kv { display: grid; grid-template-columns: 118px 1fr; gap: 8px; padding: 3px 0; }
      .kv .k { color: #64748b; }
      .kv .v { font-weight: 600; color: #0f172a; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        overflow: hidden;
      }
      th, td {
        padding: 9px 10px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      th {
        background: #f8fafc;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: #475569;
      }
      td:last-child, th:last-child { text-align: right; }
      .totals {
        margin-top: 10px;
        display: flex;
        justify-content: flex-end;
      }
      .totals-box {
        width: 290px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        overflow: hidden;
      }
      .totals-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      .totals-row:last-child { border-bottom: 0; }
      .totals-row.grand {
        background: #eef2ff;
        font-weight: 800;
      }
      .note {
        margin-top: 10px;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        padding: 8px 10px;
        color: #334155;
      }
      .footer {
        margin-top: 22px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: 10px;
        color: #64748b;
        border-top: 1px solid #e5e7eb;
        padding-top: 8px;
      }
      .ref {
        font-family: "Consolas", monospace;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 6px 8px;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="topbar">
        <div class="brand">
          <h1>Wallet Proforma</h1>
          <p class="company">${escapeHtml(payload.companyName)}</p>
          <p>${escapeHtml(payload.companyAddress)}</p>
          <p>Phone: ${escapeHtml(payload.companyPhone)} | Email: ${escapeHtml(payload.companyEmail)}</p>
          <p>TRN: ${escapeHtml(payload.companyTrn)}</p>
        </div>
        <div class="meta">
          <div class="logo-box">
            ${
              payload.companyLogo
                ? `<img src="${payload.companyLogo}" alt="Company logo" />`
                : `<span style="color:#64748b; font-size:11px;">NO LOGO</span>`
            }
          </div>
          <div class="meta-row"><span class="meta-key">Proforma Ref</span><span class="meta-val">${escapeHtml(payload.txnRef)}</span></div>
          <div class="meta-row"><span class="meta-key">Date</span><span class="meta-val">${escapeHtml(payload.date)}</span></div>
          <div class="meta-row"><span class="meta-key">Transaction</span><span class="meta-val">${escapeHtml(payload.txnId)}</span></div>
          <div class="status-chip">${escapeHtml(payload.status)}</div>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <h3>Customer Details</h3>
          <div class="kv"><div class="k">Customer Code</div><div class="v">${escapeHtml(payload.customerId)}</div></div>
          <div class="kv"><div class="k">Customer Name</div><div class="v">${escapeHtml(payload.customerName)}</div></div>
          <div class="kv"><div class="k">Phone</div><div class="v">${escapeHtml(payload.customerPhone)}</div></div>
          <div class="kv"><div class="k">Email</div><div class="v">${escapeHtml(payload.customerEmail)}</div></div>
        </div>
        <div class="card">
          <h3>Transaction Details</h3>
          <div class="kv"><div class="k">Payment Mode</div><div class="v">${escapeHtml(payload.mode)}</div></div>
          <div class="kv"><div class="k">Payment Date</div><div class="v">${escapeHtml(payload.date)}</div></div>
          <div class="kv"><div class="k">Collected By</div><div class="v">${escapeHtml(payload.collectedBy)}</div></div>
          <div class="kv"><div class="k">Status</div><div class="v">${escapeHtml(payload.status)}</div></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:70px;">#</th>
            <th>Description</th>
            <th style="width:90px;">Qty</th>
            <th style="width:140px;">Unit Price</th>
            <th style="width:140px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Customer Wallet Topup</td>
            <td>1</td>
            <td>${escapeHtml(payload.amount)}</td>
            <td>${escapeHtml(payload.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(payload.amount)}</span></div>
          <div class="totals-row"><span>VAT (0%)</span><span>AED 0.00</span></div>
          <div class="totals-row grand"><span>Grand Total</span><span>${escapeHtml(payload.amount)}</span></div>
        </div>
      </div>

      <div class="note">
        <strong>Note:</strong> This proforma confirms wallet credit transaction. 1 wallet unit = AED 1.00.
      </div>

      <div class="footer">
        <div>
          Generated: ${escapeHtml(payload.generatedAt)}<br />
          This is system-generated and does not require signature.
        </div>
        <div class="ref">REF: ${escapeHtml(payload.txnRef)} | TXN: ${escapeHtml(payload.txnId)}</div>
      </div>
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
    const companyTrn = (company as any).trn_number || "-";
    const companyAddress = [
      (company as any).address_line1,
      (company as any).address_line2,
      (company as any).city,
      (company as any).country,
    ]
      .filter(Boolean)
      .join(", ") || "-";
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

    const allCustomerTx = await Crm.listCustomerWalletTopups(companyId, id, false);
    const txWithMeta = (allCustomerTx ?? []).find((row) => row.id === transactionId) as any;
    const serialNo = Number((txn as any).serial_no ?? txWithMeta?.serial_no ?? 0);
    const txnRef = serialNo > 0 ? `TXN-${String(Math.trunc(serialNo)).padStart(6, "0")}` : String(txn.id);
    const collectedBy =
      String(txWithMeta?.approved_by_name ?? (txn as any).approved_by ?? "-") || "-";

    const html = buildProformaHtml({
      companyName: String(companyName),
      companyPhone: String(companyPhone),
      companyEmail: String(companyEmail),
      companyAddress: String(companyAddress),
      companyTrn: String(companyTrn),
      companyLogo,
      customerId: String((customer as any).code ?? id),
      customerName: String(customer.name ?? "Customer"),
      customerPhone: String(customer.phone ?? "-"),
      customerEmail: String(customer.email ?? "-"),
      txnId: String(txn.id),
      txnRef,
      date: formatDateOnly(txn.payment_date ?? txn.created_at ?? null),
      status: txn.approved_at ? "Paid" : "Unapproved",
      mode: String(txn.payment_method ?? "-"),
      amount: formatMoney(Number(txn.amount ?? 0)),
      collectedBy,
      generatedAt: formatDateOnly(new Date().toISOString()),
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
