import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { Crm, Files } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";
import {
  getInspectionById,
  listInspectionItems,
  listInspectionLineItems,
} from "@repo/ai-core/workshop/inspections/repository";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

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

function titleize(value?: string | null) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function checklistValue(score: number | null | undefined) {
  const num = Number(score ?? 0);
  if (num === 1) return "Good";
  if (num === 2) return "Average";
  if (num >= 3) return "Bad";
  return "-";
}

function buildInspectionHtml(payload: {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTrn: string;
  companyLogo?: string | null;
  inspectionId: string;
  status: string;
  startAt: string;
  completedAt: string;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  carPlate: string;
  carModel: string;
  advisorRemark: string;
  customerRemark: string;
  inspectorRemark: string;
  health: Array<{ label: string; value: string }>;
  items: Array<{ partName: string; requiredAction: string; severity: string; techReason: string }>;
  findings: Array<{ productName: string; qty: string; status: string; reason: string }>;
}) {
  const healthRows = payload.health
    .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
    .join("");
  const itemsRows = payload.items
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.partName)}</td><td>${escapeHtml(row.requiredAction)}</td><td>${escapeHtml(
          row.severity
        )}</td><td>${escapeHtml(row.techReason)}</td></tr>`
    )
    .join("");
  const findingsRows = payload.findings
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.qty)}</td><td>${escapeHtml(
          row.status
        )}</td><td>${escapeHtml(row.reason)}</td></tr>`
    )
    .join("");

  const isCompleted = String(payload.status).toLowerCase() === "completed";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Inspection Report</title>
    <style>
      @page { size: A4; margin: 18mm 14mm; }
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      .brand { flex: 1; padding: 14px 16px; }
      .brand h1 { margin: 0; font-size: 14px; letter-spacing: 0.3px; color: #0f172a; }
      .brand .company { margin-top: 6px; font-size: 14px; font-weight: 700; color: #0f172a; }
      .brand p { margin: 4px 0 0; color: #475569; }
      .meta {
        width: 235px;
        border-left: 1px solid #e5e7eb;
        background: #fff;
        padding: 12px 14px;
      }
      .logo-box {
        width: 92px; height: 92px;
        border: 1px solid #e5e7eb; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; margin-bottom: 10px; background: #fff;
      }
      .logo-box img { width: 100%; height: 100%; object-fit: contain; }
      .meta-row { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #e5e7eb; }
      .meta-row:last-child { border-bottom: 0; }
      .meta-key { color: #64748b; font-weight: 600; }
      .meta-val { color: #111827; font-weight: 700; }
      .status-chip {
        display: inline-block; margin-top: 8px; padding: 4px 8px; border-radius: 999px;
        font-size: 10px; font-weight: 700;
        border: 1px solid ${isCompleted ? "#059669" : "#d97706"};
        color: ${isCompleted ? "#065f46" : "#92400e"};
        background: ${isCompleted ? "#d1fae5" : "#fef3c7"};
      }
      .section-title {
        margin-top: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #f8fafc;
        padding: 7px;
        text-align: center;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 12px;
      }
      .cards { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
      .card h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #0f172a; }
      .kv { display: grid; grid-template-columns: 116px 1fr; gap: 8px; padding: 3px 0; }
      .kv .k { color: #64748b; }
      .kv .v { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
      th { background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px; }
      .footer {
        margin-top: 14px;
        border-top: 1px solid #e5e7eb;
        padding-top: 8px;
        font-size: 10px;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <div class="topbar">
      <div class="brand">
        <h1>Inspection Report</h1>
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
        <div class="meta-row"><span class="meta-key">Inspection ID</span><span class="meta-val">${escapeHtml(payload.inspectionId)}</span></div>
        <div class="meta-row"><span class="meta-key">Started</span><span class="meta-val">${escapeHtml(payload.startAt)}</span></div>
        <div class="meta-row"><span class="meta-key">Completed</span><span class="meta-val">${escapeHtml(payload.completedAt)}</span></div>
        <div class="status-chip">${escapeHtml(titleize(payload.status))}</div>
      </div>
    </div>

    <div class="section-title">Customer & Car</div>
    <div class="cards">
      <div class="card">
        <h3>Customer Details</h3>
        <div class="kv"><div class="k">Customer Code</div><div class="v">${escapeHtml(payload.customerCode)}</div></div>
        <div class="kv"><div class="k">Customer Name</div><div class="v">${escapeHtml(payload.customerName)}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v">${escapeHtml(payload.customerPhone)}</div></div>
      </div>
      <div class="card">
        <h3>Car Details</h3>
        <div class="kv"><div class="k">Plate #</div><div class="v">${escapeHtml(payload.carPlate)}</div></div>
        <div class="kv"><div class="k">Car</div><div class="v">${escapeHtml(payload.carModel)}</div></div>
      </div>
    </div>

    <div class="section-title">Checklist Summary</div>
    <table>
      <thead><tr><th>Checkpoint</th><th>Result</th></tr></thead>
      <tbody>${healthRows || `<tr><td colspan="2">No checklist data</td></tr>`}</tbody>
    </table>

    <div class="section-title">Inspection Items</div>
    <table>
      <thead><tr><th>Part</th><th>Action</th><th>Severity</th><th>Reason</th></tr></thead>
      <tbody>${itemsRows || `<tr><td colspan="4">No inspection items</td></tr>`}</tbody>
    </table>

    <div class="section-title">Findings / Parts Needed</div>
    <table>
      <thead><tr><th>Product</th><th>Qty</th><th>Status</th><th>Reason</th></tr></thead>
      <tbody>${findingsRows || `<tr><td colspan="4">No findings</td></tr>`}</tbody>
    </table>

    <div class="section-title">Remarks</div>
    <div class="cards">
      <div class="card">
        <h3>Customer Complaint</h3>
        <div>${escapeHtml(payload.customerRemark)}</div>
      </div>
      <div class="card">
        <h3>Advisor / Inspector</h3>
        <div><strong>Advisor:</strong> ${escapeHtml(payload.advisorRemark)}</div>
        <div style="margin-top:6px;"><strong>Inspector:</strong> ${escapeHtml(payload.inspectorRemark)}</div>
      </div>
    </div>

    <div class="footer">
      Generated on ${escapeHtml(formatDateOnly(new Date().toISOString()))}. This is system generated and does not require signature.
    </div>
  </body>
</html>`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    const { companyId, inspectionId } = await params;
    const inspection = await getInspectionById(companyId, inspectionId);
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const [company, customer, car, items, lineItems] = await Promise.all([
      getCompanyById(companyId).catch(() => null),
      inspection.customerId ? Crm.getCustomerById(inspection.customerId).catch(() => null) : Promise.resolve(null),
      inspection.carId ? Crm.getCarById(inspection.carId).catch(() => null) : Promise.resolve(null),
      listInspectionItems(inspectionId).catch(() => []),
      listInspectionLineItems(inspectionId, { source: "inspection" }).catch(() => []),
    ]);

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

    const html = buildInspectionHtml({
      companyName: String((company as any)?.display_name ?? (company as any)?.legal_name ?? "Company"),
      companyAddress:
        [((company as any)?.address_line1 ?? ""), ((company as any)?.address_line2 ?? ""), ((company as any)?.city ?? ""), ((company as any)?.country ?? "")]
          .filter(Boolean)
          .join(", ") || "-",
      companyPhone: String((company as any)?.company_phone ?? "-"),
      companyEmail: String((company as any)?.company_email ?? "-"),
      companyTrn: String((company as any)?.trn_number ?? "-"),
      companyLogo,
      inspectionId: String(inspection.id),
      status: String(inspection.status ?? "pending"),
      startAt: formatDateOnly(inspection.startAt ?? inspection.createdAt),
      completedAt: formatDateOnly(inspection.completeAt),
      customerCode: String((customer as any)?.code ?? inspection.customerId ?? "-"),
      customerName: String((customer as any)?.name ?? "-"),
      customerPhone: String((customer as any)?.phone ?? "-"),
      carPlate: String((car as any)?.plate_number ?? "-"),
      carModel: String([((car as any)?.make ?? ""), ((car as any)?.model ?? "")].filter(Boolean).join(" ") || "-"),
      advisorRemark: String(inspection.agentRemark ?? "-"),
      customerRemark: String(inspection.customerRemark ?? "-"),
      inspectorRemark: String(inspection.inspectorRemark ?? "-"),
      health: [
        { label: "Engine", value: checklistValue(inspection.healthEngine) },
        { label: "Transmission", value: checklistValue(inspection.healthTransmission) },
        { label: "Brakes", value: checklistValue(inspection.healthBrakes) },
        { label: "Suspension", value: checklistValue(inspection.healthSuspension) },
        { label: "Electrical", value: checklistValue(inspection.healthElectrical) },
        { label: "Overall", value: checklistValue(inspection.overallHealth) },
      ],
      items: (items ?? []).map((row) => ({
        partName: String((row as any)?.partName ?? "-"),
        requiredAction: String((row as any)?.requiredAction ?? "-"),
        severity: String((row as any)?.severity ?? "-"),
        techReason: String((row as any)?.techReason ?? "-"),
      })),
      findings: (lineItems ?? []).map((row) => ({
        productName: String((row as any)?.productName ?? (row as any)?.description ?? "-"),
        qty: String((row as any)?.quantity ?? "-"),
        status: titleize(String((row as any)?.status ?? "-")),
        reason: String((row as any)?.reason ?? "-"),
      })),
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
        "Content-Disposition": `inline; filename="inspection-${inspection.id}.pdf"`,
      },
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    console.error("GET /api/company/[companyId]/workshop/inspections/[inspectionId]/print error:", error);
    return NextResponse.json({ error: "Failed to generate inspection PDF" }, { status: 500 });
  }
}
