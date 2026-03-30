import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { Files } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";
import { getPurchaseOrderWithItems } from "@repo/ai-core/workshop/procurement/repository";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; poId: string }> };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(payload: {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTrn: string;
  companyLogo?: string | null;
  poNumber: string;
  status: string;
  createdAt: string;
  rows: Array<{ grnNumber: string; partName: string; quantity: number; receivedBy?: string | null; createdAt: string }>;
}) {
  const rowsHtml = payload.rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.grnNumber)}</td>
        <td>${escapeHtml(row.partName || "-")}</td>
        <td class="num">${Number(row.quantity ?? 0).toFixed(2)}</td>
        <td>${escapeHtml(row.receivedBy || "-")}</td>
        <td>${escapeHtml(new Date(row.createdAt).toLocaleString())}</td>
      </tr>
    `
    )
    .join("");

  const totalQty = payload.rows.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
  const statusColor = payload.status === "received" ? "#059669" : payload.status === "issued" ? "#0891b2" : "#d97706";

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>GRN ${escapeHtml(payload.poNumber)}</title>
      <style>
        @page { size: A4; margin: 12mm 14mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "Segoe UI", -apple-system, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; }
        h2 { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #059669; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 18px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 8px; color: white; }
        .header-left { display: flex; gap: 14px; align-items: center; }
        .logo { width: 52px; height: 52px; border-radius: 8px; object-fit: contain; background: white; padding: 4px; }
        .header-title { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
        .header-sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
        .header-right { text-align: right; font-size: 10px; }
        .header-badge { display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 4px; font-weight: 700; font-size: 10px; text-transform: uppercase; background: ${statusColor}; color: white; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .info-cell { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
        .info-cell:nth-child(3n+2) { border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
        .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
        .info-value { font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px; }

        .summary-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px; }
        .summary-card { text-align: center; padding: 12px; border-radius: 8px; }
        .summary-card .number { font-size: 24px; font-weight: 800; line-height: 1; }
        .summary-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600; }

        .section { margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f8fafc; padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 11px; }
        tr:last-child td { border-bottom: none; }
        .grn-num { font-weight: 700; color: #059669; font-family: monospace; font-size: 11px; }
        .qty { text-align: center; font-weight: 700; font-size: 12px; }
        .timestamp { font-size: 10px; color: #64748b; }

        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px; }
        .empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; border: 1px dashed #e2e8f0; border-radius: 6px; margin-top: 8px; }

        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; }
        .sig-box { border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; }
        .sig-label { font-size: 10px; color: #64748b; font-weight: 600; }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="header-left">
          ${payload.companyLogo
            ? `<img class="logo" src="${payload.companyLogo}" alt="logo" />`
            : `<div class="logo" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:#0f172a;font-weight:700;">LOGO</div>`
          }
          <div>
            <div class="header-title">Goods Receipt Note</div>
            <div class="header-sub">${escapeHtml(payload.companyName)} | ${escapeHtml(payload.companyPhone)}</div>
          </div>
        </div>
        <div class="header-right">
          <div style="font-weight:700;font-size:12px;">${escapeHtml(payload.poNumber)}</div>
          <div style="margin-top:2px;">${escapeHtml(new Date(payload.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }))}</div>
          <div class="header-badge">${escapeHtml(payload.status)}</div>
        </div>
      </div>

      <!-- Company Info -->
      <div class="info-grid">
        <div class="info-cell"><div class="info-label">Company</div><div class="info-value">${escapeHtml(payload.companyName)}</div></div>
        <div class="info-cell"><div class="info-label">Address</div><div class="info-value">${escapeHtml(payload.companyAddress)}</div></div>
        <div class="info-cell"><div class="info-label">TRN</div><div class="info-value">${escapeHtml(payload.companyTrn)}</div></div>
        <div class="info-cell"><div class="info-label">Phone</div><div class="info-value">${escapeHtml(payload.companyPhone)}</div></div>
        <div class="info-cell"><div class="info-label">Email</div><div class="info-value">${escapeHtml(payload.companyEmail)}</div></div>
        <div class="info-cell"><div class="info-label">PO Number</div><div class="info-value" style="font-family:monospace;">${escapeHtml(payload.poNumber)}</div></div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card" style="background:#f0fdf4;border:1px solid #bbf7d0;">
          <div class="number" style="color:#059669;">${payload.rows.length}</div>
          <div class="label" style="color:#059669;">GRN Entries</div>
        </div>
        <div class="summary-card" style="background:#ecfeff;border:1px solid #a5f3fc;">
          <div class="number" style="color:#0891b2;">${totalQty.toFixed(0)}</div>
          <div class="label" style="color:#0891b2;">Total Qty Received</div>
        </div>
        <div class="summary-card" style="background:#f8fafc;border:1px solid #e2e8f0;">
          <div class="number" style="color:${statusColor};">${escapeHtml(payload.status.toUpperCase())}</div>
          <div class="label" style="color:#64748b;">PO Status</div>
        </div>
      </div>

      <!-- GRN Table -->
      <div class="section">
        <h2>Receipt Details</h2>
        ${payload.rows.length ? `
          <table>
            <thead>
              <tr>
                <th style="width:5%">#</th>
                <th style="width:25%">GRN Number</th>
                <th style="width:25%">Part / Description</th>
                <th style="width:10%">Qty</th>
                <th style="width:15%">Received By</th>
                <th style="width:20%">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              ${payload.rows.map((row, i) => `
                <tr>
                  <td style="text-align:center;color:#94a3b8;font-weight:600;">${i + 1}</td>
                  <td><span class="grn-num">${escapeHtml(row.grnNumber)}</span></td>
                  <td><strong>${escapeHtml(row.partName || "-")}</strong></td>
                  <td class="qty">${Number(row.quantity ?? 0).toFixed(0)}</td>
                  <td>${escapeHtml(row.receivedBy || "-")}</td>
                  <td class="timestamp">${escapeHtml(new Date(row.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">No GRN entries recorded for this purchase order.</div>`}
      </div>

      <!-- Signatures -->
      <div class="signatures">
        <div class="sig-box"><div class="sig-label">Received By</div></div>
        <div class="sig-box"><div class="sig-label">Verified By</div></div>
        <div class="sig-box"><div class="sig-label">Approved By</div></div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div>${escapeHtml(payload.companyName)} | ${escapeHtml(payload.companyEmail)}</div>
        <div>Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
      </div>
    </body>
  </html>`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, poId } = await params;

  const data = await getPurchaseOrderWithItems(companyId, poId);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const company: any = await getCompanyById(companyId).catch(() => null);
  const companyName = company?.display_name || company?.legal_name || "Company";
  const companyAddress = [company?.address_line1, company?.address_line2, company?.city, company?.country]
    .filter(Boolean)
    .join(", ") || "-";
  const companyPhone = company?.company_phone || "-";
  const companyEmail = company?.company_email || "-";
  const companyTrn = company?.trn_number || "-";

  const logoFileId = company?.logo_file_id ?? null;
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

  const html = buildHtml({
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    companyTrn,
    companyLogo,
    poNumber: data.po.poNumber,
    status: data.po.status,
    createdAt: data.po.createdAt,
    rows: (data.grns ?? []).map((g) => ({
      grnNumber: g.grnNumber,
      partName: g.partName,
      quantity: g.quantity,
      receivedBy: g.receivedBy ?? null,
      createdAt: g.createdAt,
    })),
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await page.close();
  await browser.close();

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="grn-${data.po.poNumber}.pdf"`,
    },
  });
}
