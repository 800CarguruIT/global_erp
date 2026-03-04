import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { getSql } from "@repo/ai-core/db";
import { Files } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; estimateId: string }> };

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
  return Number(value || 0).toFixed(2);
}

function buildInvoiceHtml(payload: {
  companyName: string;
  companyLogo?: string | null;
  customerName: string;
  customerPhone: string;
  carMakeModel: string;
  carPlate: string;
  invoiceRef: string;
  date: string;
  items: Array<{
    name: string;
    description: string;
    qty: number;
    rate: number;
    discount: number;
    price: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    vat: number;
    grandTotal: number;
  };
}) {
  const rows = payload.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="center">${formatMoney(item.qty)}</td>
        <td class="right">${formatMoney(item.rate)}</td>
        <td class="right">${formatMoney(item.discount)}</td>
        <td class="right">${formatMoney(item.price)}</td>
      </tr>
    `
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Tax Invoice</title>
      <style>
        @page { size: A4; margin: 18mm 14mm; }
        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; }
        .bar { margin-top: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f8fafc; color: #0f172a; text-align: center; font-weight: 700; padding: 7px; text-transform: uppercase; font-size: 12px; }
        .top { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; background: #fff; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .logo-box { width: 72px; height: 72px; border: 1px solid #e5e7eb; border-radius: 8px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#fff; flex-shrink:0; }
        .logo-box img { width:100%; height:100%; object-fit:contain; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; }
        .kv { display: grid; grid-template-columns: 120px 1fr; gap: 6px; padding: 2px 0; font-size: 12px; }
        .k { color: #64748b; }
        .v { color: #0f172a; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 7px; }
        th { background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px; }
        .center { text-align: center; }
        .right { text-align: right; }
        .totals { margin-top: 8px; margin-left: auto; width: 260px; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
        .totals .row { display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
        .totals .row:last-child { border-bottom: 0; background: #eef2ff; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="top">
        <div>
          <div style="font-size:14px;font-weight:700;">Tax Invoice</div>
          <div style="font-size:12px;color:#64748b;">${escapeHtml(payload.companyName)}</div>
        </div>
        <div class="logo-box">
          ${
            payload.companyLogo
              ? `<img src="${payload.companyLogo}" alt="Company logo" />`
              : `<span style="font-size:10px;color:#94a3b8;">NO LOGO</span>`
          }
        </div>
      </div>
      <div class="meta">
        <div class="card">
          <div class="kv"><div class="k">Customer</div><div class="v">${escapeHtml(payload.customerName)}</div></div>
          <div class="kv"><div class="k">Phone</div><div class="v">${escapeHtml(payload.customerPhone)}</div></div>
          <div class="kv"><div class="k">Car</div><div class="v">${escapeHtml(payload.carMakeModel)}</div></div>
          <div class="kv"><div class="k">Plate</div><div class="v">${escapeHtml(payload.carPlate)}</div></div>
        </div>
        <div class="card">
          <div class="kv"><div class="k">Invoice Ref</div><div class="v">${escapeHtml(payload.invoiceRef)}</div></div>
          <div class="kv"><div class="k">Date</div><div class="v">${escapeHtml(payload.date)}</div></div>
          <div class="kv"><div class="k">Status</div><div class="v">Invoiced</div></div>
        </div>
      </div>
      <div class="bar">Items</div>
      <table>
        <thead>
          <tr>
            <th style="width:30%;">Item</th>
            <th>Description</th>
            <th style="width:10%;">Qty</th>
            <th style="width:15%;">Rate</th>
            <th style="width:15%;">Discount</th>
            <th style="width:15%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" class="center">No items</td></tr>`}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>AED ${formatMoney(payload.totals.subtotal)}</span></div>
        <div class="row"><span>Discount</span><span>AED ${formatMoney(payload.totals.discount)}</span></div>
        <div class="row"><span>VAT</span><span>AED ${formatMoney(payload.totals.vat)}</span></div>
        <div class="row"><span>Grand Total</span><span>AED ${formatMoney(payload.totals.grandTotal)}</span></div>
      </div>
    </body>
  </html>`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    const { companyId, estimateId } = await params;
    const sql = getSql();
    const estimateRows = await sql`
      SELECT
        id,
        customer_id,
        car_id,
        inspection_id,
        created_at,
        invoice_date,
        total_sale,
        total_discount,
        vat_amount,
        grand_total,
        vat_rate,
        meta
      FROM estimates
      WHERE company_id = ${companyId} AND id = ${estimateId}
      LIMIT 1
    `;
    if (!estimateRows.length) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }
    const estimate = estimateRows[0];
    const company = await getCompanyById(companyId).catch(() => null);

    const isLegacyEstimate =
      String((estimate.meta as any)?.legacy_source ?? "").trim().toLowerCase() === "carguru2.estimates";
    const itemRows = isLegacyEstimate
      ? await sql`
          SELECT
            li.product_name AS part_name,
            li.description,
            li.quantity,
            COALESCE(li.approved_sale, li.approved_cost, 0)::numeric AS sale,
            COALESCE(li.discount_amount, 0)::numeric AS discount
          FROM line_items li
          WHERE li.company_id = ${companyId}
            AND li.inspection_id = ${estimate.inspection_id}
            AND COALESCE(li.is_add, 0) = 0
          ORDER BY li.created_at ASC, li.id ASC
        `
      : await sql`
          SELECT
            ei.part_name,
            ei.description,
            ei.quantity,
            COALESCE(ei.sale, 0)::numeric AS sale,
            0::numeric AS discount
          FROM estimate_items ei
          WHERE ei.estimate_id = ${estimateId}
          ORDER BY ei.line_no ASC, ei.created_at ASC
        `;
    const customerRows = estimate.customer_id
      ? await sql`SELECT name, phone FROM customers WHERE id = ${estimate.customer_id} LIMIT 1`
      : [];
    const carRows = estimate.car_id
      ? await sql`SELECT make, model, plate_number FROM cars WHERE id = ${estimate.car_id} LIMIT 1`
      : [];

    const customer = customerRows[0] ?? null;
    const car = carRows[0] ?? null;
    const companyName = String((company as any)?.display_name ?? (company as any)?.legal_name ?? "800CARGURU");
    const logoFileId = (company as any)?.logo_file_id ?? null;
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
    const items = itemRows.map((item: any) => {
      const qty = Number(item.quantity ?? 0) || 0;
      const rate = Number(item.sale ?? 0) || 0;
      const discount = Number(item.discount ?? 0) || 0;
      return {
        name: item.part_name ?? "",
        description: item.description ?? "",
        qty,
        rate,
        discount,
        price: qty * rate - discount,
      };
    });
    const subtotal = Number(estimate.total_sale ?? items.reduce((sum: number, item: any) => sum + Number(item.price ?? 0), 0));
    const discountTotal = Number(estimate.total_discount ?? 0);
    const vatTotal =
      estimate.vat_amount != null
        ? Number(estimate.vat_amount)
        : Number((((subtotal - discountTotal) * Number(estimate.vat_rate ?? 5)) / 100).toFixed(2));
    const grandTotal =
      estimate.grand_total != null
        ? Number(estimate.grand_total)
        : Number((subtotal - discountTotal + vatTotal).toFixed(2));
    const invoiceRef =
      (estimate.meta as any)?.legacy_estimate_id != null
        ? `CG-INV-${String((estimate.meta as any).legacy_estimate_id).padStart(9, "0")}`
        : `INV-${String(estimate.id).slice(0, 8).toUpperCase()}`;
    const html = buildInvoiceHtml({
      companyName,
      companyLogo,
      customerName: String(customer?.name ?? "Customer"),
      customerPhone: String(customer?.phone ?? "-"),
      carMakeModel: String([car?.make, car?.model].filter(Boolean).join(" ") || "-"),
      carPlate: String(car?.plate_number ?? "-"),
      invoiceRef,
      date: formatDateOnly(estimate.invoice_date ?? estimate.created_at),
      items,
      totals: {
        subtotal,
        discount: discountTotal,
        vat: vatTotal,
        grandTotal,
      },
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
        "Content-Disposition": `inline; filename="invoice-${estimate.id}.pdf"`,
      },
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    console.error("GET /api/company/[companyId]/workshop/estimates/[estimateId]/invoice error:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
