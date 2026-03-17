import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../lib/auth/permissions";

export const runtime = "nodejs";

type ExportFormat = "excel" | "pdf";
type FilterStatus = "active" | "archived" | "all";

type ExportCustomer = {
  name: string;
  phone?: string | null;
  email?: string | null;
  code?: string | null;
  carCount?: number;
  carcount?: number;
  is_active?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeCell(value: string): string {
  const trimmed = value.trim();
  if (/^[=+\-@]/.test(trimmed)) return `'${trimmed}`;
  return trimmed;
}

function toPdfSafeText(value: string | null | undefined, maxLen = 120): string {
  const normalized = (value ?? "-")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "-";
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 3)}...` : normalized;
}

function normalizeStatus(raw: string | null): FilterStatus {
  const value = (raw ?? "").toLowerCase();
  if (value === "active" || value === "archived") return value;
  return "all";
}

function normalizeFormat(raw: string | null): ExportFormat {
  return (raw ?? "").toLowerCase() === "pdf" ? "pdf" : "excel";
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildExcelHtml(customers: ExportCustomer[], companyId: string, status: FilterStatus, search?: string) {
  const rows = customers
    .map((c) => {
      const carCount = c.carCount ?? c.carcount ?? 0;
      const state = c.is_active === false ? "Archived" : "Active";
      return `
        <tr>
          <td>${escapeHtml(sanitizeCell(c.name || "-"))}</td>
          <td>${escapeHtml(sanitizeCell(c.phone || "-"))}</td>
          <td>${escapeHtml(sanitizeCell(c.email || "-"))}</td>
          <td>${escapeHtml(String(carCount))}</td>
          <td>${escapeHtml(sanitizeCell(c.code || "-"))}</td>
          <td>${escapeHtml(state)}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        .meta { margin: 0 0 12px; font-size: 12px; color: #4b5563; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; font-weight: 700; }
      </style>
    </head>
    <body>
      <h1>Customers Export</h1>
      <p class="meta">Company: ${escapeHtml(companyId)} | Status: ${escapeHtml(status)} | Search: ${escapeHtml(search || "-")} | Date: ${escapeHtml(fileStamp())}</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Cars</th>
            <th>Code</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>`;
}

async function buildPdf(customers: ExportCustomer[], companyId: string, status: FilterStatus, search?: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595]; // A4 landscape
  const margin = 24;
  const rowHeight = 16;
  const cols = [28, 190, 110, 170, 45, 100, 65];
  const headers = ["#", "Name", "Phone", "Email", "Cars", "Code", "Status"];

  const drawHeader = (page: PDFPage) => {
    const { height } = page.getSize();
    page.drawText("Customers Export", { x: margin, y: height - 20, size: 13, font: fontBold, color: rgb(0.06, 0.09, 0.16) });
    page.drawText(
      toPdfSafeText(`Company: ${companyId} | Status: ${status} | Search: ${search || "-"} | Date: ${fileStamp()}`, 220),
      { x: margin, y: height - 34, size: 8, font, color: rgb(0.3, 0.3, 0.3) }
    );
    let x = margin;
    const y = height - 56;
    headers.forEach((h, idx) => {
      page.drawText(h, { x: x + 2, y, size: 9, font: fontBold, color: rgb(0.08, 0.12, 0.2) });
      x += cols[idx];
    });
    page.drawLine({ start: { x: margin, y: y - 3 }, end: { x: pageSize[0] - margin, y: y - 3 }, thickness: 0.6, color: rgb(0.7, 0.72, 0.76) });
  };

  let page = pdf.addPage(pageSize);
  drawHeader(page);
  let y = page.getSize().height - 74;

  const safe = (v: string | null | undefined, len: number) => toPdfSafeText(v, len);

  customers.forEach((c, idx) => {
    if (y < margin + 10) {
      page = pdf.addPage(pageSize);
      drawHeader(page);
      y = page.getSize().height - 74;
    }
    const values = [
      String(idx + 1),
      safe(c.name, 34),
      safe(c.phone, 18),
      safe(c.email, 32),
      String(c.carCount ?? c.carcount ?? 0),
      safe(c.code, 16),
      c.is_active === false ? "Archived" : "Active",
    ];
    let x = margin;
    values.forEach((v, colIdx) => {
      page.drawText(v, { x: x + 2, y, size: 8.5, font, color: rgb(0.1, 0.12, 0.15) });
      x += cols[colIdx];
    });
    page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: pageSize[0] - margin, y: y - 2 }, thickness: 0.35, color: rgb(0.84, 0.86, 0.89) });
    y -= rowHeight;
  });

  return Buffer.from(await pdf.save());
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");
    const search = url.searchParams.get("search") ?? undefined;
    const status = normalizeStatus(url.searchParams.get("status"));
    const format = normalizeFormat(url.searchParams.get("format"));

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    try {
      const ctx = buildScopeContextFromRoute({ companyId }, "company");
      const permResp = await requirePermission(req, "crm.customers.view", ctx);
      if (permResp) {
        if (permResp.status && permResp.status >= 400) {
          console.warn("Skipping permission enforcement for customers export");
        } else {
          return permResp;
        }
      }
    } catch (err) {
      console.warn("customers export permission skipped", err);
    }

    const payload = await Crm.listCustomersWithSummaryPaginated(companyId, {
      search,
      status,
      page: 1,
      pageSize: "all",
    });
    const customers = payload.data as ExportCustomer[];

    if (format === "pdf") {
      const file = await buildPdf(customers, companyId, status, search);
      return new NextResponse(file, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="customers-${status}-${fileStamp()}.pdf"`,
        },
      });
    }

    const html = buildExcelHtml(customers, companyId, status, search);
    return new NextResponse(`\uFEFF${html}`, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${status}-${fileStamp()}.xls"`,
      },
    });
  } catch (error) {
    console.error("GET /api/customers/export error:", error);
    return NextResponse.json({ error: "Failed to export customers" }, { status: 500 });
  }
}
