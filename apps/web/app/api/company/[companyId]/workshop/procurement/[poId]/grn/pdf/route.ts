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

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>GRN ${escapeHtml(payload.poNumber)}</title>
      <style>
        @page { size: A4; margin: 18mm 14mm; }
        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          overflow: hidden;
          background: #fff;
          margin-bottom: 12px;
        }
        .brand { flex: 1; padding: 14px 16px; }
        .brand h1 { margin: 0; font-size: 14px; letter-spacing: 0.3px; color: #0f172a; }
        .brand .company { margin-top: 6px; font-size: 14px; font-weight: 700; color: #0f172a; }
        .brand p { margin: 4px 0 0; font-size: 12px; color: #475569; }
        .meta-panel {
          width: 230px;
          border-left: 1px solid #e5e7eb;
          background: #fff;
          padding: 12px 14px;
        }
        .logo-box {
          width: 92px;
          height: 92px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          overflow: hidden;
          background: #fff;
        }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .meta-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 4px 0;
          border-bottom: 1px dashed #e5e7eb;
          font-size: 12px;
        }
        .meta-row:last-child { border-bottom: 0; }
        .meta-key { color: #64748b; font-weight: 600; }
        .meta-val { color: #111827; font-weight: 700; }
        .bar {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #f8fafc;
          color: #0f172a;
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 7px;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 8px;
        }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; }
        th { background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px; }
        .num { text-align: right; }
        .empty { margin-top: 12px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="topbar">
        <div class="brand">
          <h1>Goods Receipt Note</h1>
          <p class="company">${escapeHtml(payload.companyName)}</p>
          <p>${escapeHtml(payload.companyAddress)}</p>
          <p>Phone: ${escapeHtml(payload.companyPhone)} | Email: ${escapeHtml(payload.companyEmail)}</p>
          <p>TRN: ${escapeHtml(payload.companyTrn)}</p>
        </div>
        <div class="meta-panel">
          <div class="logo-box">
            ${
              payload.companyLogo
                ? `<img src="${payload.companyLogo}" alt="Company logo" />`
                : `<span style="color:#64748b; font-size:11px;">NO LOGO</span>`
            }
          </div>
          <div class="meta-row"><span class="meta-key">PO Number</span><span class="meta-val">${escapeHtml(payload.poNumber)}</span></div>
          <div class="meta-row"><span class="meta-key">PO Date</span><span class="meta-val">${escapeHtml(new Date(payload.createdAt).toLocaleDateString())}</span></div>
          <div class="meta-row"><span class="meta-key">Status</span><span class="meta-val">${escapeHtml(payload.status)}</span></div>
        </div>
      </div>
      <div class="bar">GRN Entries</div>
      ${
        payload.rows.length
          ? `
        <table>
          <thead>
            <tr>
              <th>GRN Number</th>
              <th>Part</th>
              <th>Qty</th>
              <th>Received By</th>
              <th>Received At</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `
          : `<div class="empty">No GRN entries found for this PO.</div>`
      }
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
