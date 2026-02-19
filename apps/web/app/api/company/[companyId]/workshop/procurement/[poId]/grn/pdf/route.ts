import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getSql } from "@repo/ai-core/db";
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
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0b1020; }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 700; }
        .meta { margin-top: 6px; font-size: 11px; color: #334155; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
        th { background: #e2e8f0; }
        .num { text-align: right; }
        .empty { margin-top: 12px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Goods Receipt Notes (GRN)</div>
        <div class="meta">
          <div><strong>Company:</strong> ${escapeHtml(payload.companyName)}</div>
          <div><strong>PO Number:</strong> ${escapeHtml(payload.poNumber)}</div>
          <div><strong>Status:</strong> ${escapeHtml(payload.status)}</div>
          <div><strong>PO Date:</strong> ${escapeHtml(new Date(payload.createdAt).toLocaleString())}</div>
        </div>
      </div>
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
  const sql = getSql();

  const data = await getPurchaseOrderWithItems(companyId, poId);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const [company] = await sql<{ display_name: string | null; legal_name: string | null }[]>`
    SELECT display_name, legal_name
    FROM companies
    WHERE id = ${companyId}
    LIMIT 1
  `;
  const companyName = company?.display_name || company?.legal_name || "Company";

  const html = buildHtml({
    companyName,
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
