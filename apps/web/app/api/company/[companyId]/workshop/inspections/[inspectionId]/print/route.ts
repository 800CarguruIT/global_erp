import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { canUseAi, Crm, Files, getOpenAIClientForCompany } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";
import { getSql } from "@repo/ai-core/db";
import {
  getInspectionById,
  listInspectionItems,
  listInspectionLineItems,
} from "@repo/ai-core/workshop/inspections/repository";
import { resolveCollectCarSource, type CollectCarSourceType } from "@/lib/collect-car-source";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

function escapeHtml(value: unknown) {
  const text = String(value ?? "");
  return text
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

function toPdfSafeText(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw) return "-";
  // StandardFonts.Helvetica supports WinAnsi; replace unsupported chars to avoid runtime encoding errors.
  return raw
    .replace(/[^\x20-\x7E\n\r\t]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function checklistValue(score: number | null | undefined) {
  const num = Number(score ?? 0);
  if (num === 1) return "Good";
  if (num === 2) return "Average";
  if (num >= 3) return "Bad";
  return "-";
}

function _buildInspectionHtmlLegacy(payload: {
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

function groupLabelFromKey(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "General";
  const base = raw.includes("::") ? raw.split("::")[0] : raw;
  const normalized = base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "General";
  if (/^\d+$/.test(normalized)) return "General";
  return normalized;
}

function scoreForSeverity(reason: string) {
  const normalized = String(reason ?? "").toLowerCase();
  if (normalized.includes("safety risk")) return 25;
  if (normalized.includes("mandatory")) return 60;
  if (normalized.includes("recommended")) return 80;
  return 100;
}

function mapGroupToCategory(group: string, part: string, observed: string) {
  const text = `${group} ${part} ${observed}`.toLowerCase();
  if (/(engine|fuel|timing|oil|coolant|exhaust|ignition)/.test(text)) return "Engine";
  if (/(transmission|gearbox|gear|clutch|drivetrain|axle|differential)/.test(text)) return "Transmission";
  if (/(brake|disc|pad|rotor|caliper|abs)/.test(text)) return "Brakes";
  if (/(suspension|strut|shock|control arm|stabilizer|bush)/.test(text)) return "Suspension";
  if (/(steering|rack|tie rod|power steering)/.test(text)) return "Steering";
  if (/(tire|tyre|wheel|rim|alignment|balanc)/.test(text)) return "Tires & Wheels";
  if (/(electrical|battery|alternator|starter|wiring|sensor|obd|ecu|infotainment|ac)/.test(text)) return "Electrical";
  if (/(body|exterior|door|bumper|fender|hood|mirror|glass|paint|panel)/.test(text)) return "Body & Exterior";
  if (/(interior|seat|dashboard|trim|cabin|upholstery)/.test(text)) return "Interior";
  return "Fluids / Maintenance";
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  Engine: 15,
  Transmission: 12,
  Brakes: 16,
  Suspension: 12,
  Steering: 10,
  "Tires & Wheels": 10,
  Electrical: 10,
  "Body & Exterior": 7,
  Interior: 4,
  "Fluids / Maintenance": 4,
};

function computeWeightedOverallHealth(
  categoryHealth: Array<{ label: string; health: number }>,
  weights: Record<string, number> = CATEGORY_WEIGHTS
) {
  const normalized = categoryHealth.map((entry) => ({
    label: entry.label,
    health: Math.max(0, Math.min(100, Number(entry.health) || 0)),
    weight: Math.max(0, Number(weights[entry.label] ?? 0)),
  }));
  const totalWeight = normalized.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return 100;
  const weighted = normalized.reduce((sum, row) => sum + row.health * row.weight, 0) / totalWeight;
  return Math.round(weighted);
}

function buildPremiumInspectionHtml(payload: {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  status?: string;
  companyLogo?: string | null;
  inspectionId: string;
  inspectionDate: string;
  customerName: string;
  vehicleText: string;
  vin: string;
  plate: string;
  mileage: string;
  tyreSizeFront: string;
  tyreSizeRear: string;
  inspectorName: string;
  inspectorRemarks: string;
  customerComplain: string;
  processChecks: Array<{ label: string; status: string; note: string; evidenceUrls: string[] }>;
  issueEntries: Array<{ description: string; evidenceUrl?: string }>;
  gallery: Array<{ label: string; url: string }>;
  overallHealth: number;
  categoryHealth: Array<{ label: string; health: number }>;
  priority: Record<"Safety Risk" | "Mandatory" | "Recommended" | "Optional", Array<{ part: string; group: string; note: string }>>;
  findings: Array<{
    part: string;
    partNumber: string;
    group: string;
    severity: string;
    observed: string;
    why: string;
    action: string;
    evidenceUrl?: string;
  }>;
  summaryText: string;
}) {
  const prioritySection = (title: string, items: Array<{ part: string; group: string; note: string }>) => `
    <div class="box">
      <h4>${escapeHtml(title)}</h4>
      ${
        items.length
          ? items
              .map(
                (item) => `
              <div class="item">
                <div class="item-title">${escapeHtml(item.part)}</div>
                <div class="muted">Part Group: ${escapeHtml(item.group)}</div>
                <div class="muted">${escapeHtml(item.note || "-")}</div>
              </div>
            `
              )
              .join("")
          : `<div class="muted">No items.</div>`
      }
    </div>
  `;

  const findingsRows = payload.findings.length
    ? payload.findings
        .map(
          (f) => `
      <div class="finding">
        <div class="finding-head">
          <div><strong>${escapeHtml(f.part)}${f.partNumber ? ` (${escapeHtml(f.partNumber)})` : ""}</strong></div>
          <div class="chip">${escapeHtml(f.severity)}</div>
        </div>
        <div class="muted">Part Group: ${escapeHtml(f.group)}</div>
        <div><strong>Observed Condition:</strong> ${escapeHtml(f.observed)}</div>
        <div><strong>Why This Matters:</strong> ${escapeHtml(f.why)}</div>
        <div><strong>Recommended Action:</strong> ${escapeHtml(f.action)}</div>
        <div class="muted"><strong>Evidence:</strong></div>
        ${
          f.evidenceUrl
            ? `<img class="evidence" src="${f.evidenceUrl}" alt="evidence" />`
            : `<div class="muted">No evidence attached.</div>`
        }
      </div>
    `
        )
        .join("")
    : `<div class="muted">No findings selected yet.</div>`;

  const healthColor = (h: number) => h >= 85 ? "#059669" : h >= 70 ? "#d97706" : h >= 50 ? "#ea580c" : "#dc2626";
  const healthLabel = (h: number) => h >= 85 ? "Excellent" : h >= 70 ? "Good" : h >= 50 ? "Needs Attention" : "Critical";
  const severityColor = (s: string) => s === "Safety Risk" ? "#dc2626" : s === "Mandatory" ? "#d97706" : s === "Recommended" ? "#0891b2" : "#64748b";
  const severityBg = (s: string) => s === "Safety Risk" ? "#fef2f2" : s === "Mandatory" ? "#fffbeb" : s === "Recommended" ? "#ecfeff" : "#f8fafc";
  const checkStatusColor = (s: string) => s === "OK" ? "#059669" : s === "ISSUE" ? "#dc2626" : "#94a3b8";
  const safetyCount = payload.priority["Safety Risk"].length;
  const mandatoryCount = payload.priority["Mandatory"].length;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Vehicle Inspection Report</title>
      <style>
        @page { size: A4; margin: 12mm 14mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "Segoe UI", -apple-system, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; }
        .page { padding: 0; }
        h2 { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #0891b2; }
        h3 { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 4px; }
        .muted { color: #64748b; font-size: 10px; }
        .section { margin-top: 14px; page-break-inside: avoid; }

        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 16px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 8px; color: white; }
        .header-left { display: flex; gap: 12px; align-items: center; }
        .logo { width: 52px; height: 52px; border-radius: 8px; object-fit: contain; background: white; padding: 4px; }
        .header-title { font-size: 18px; font-weight: 800; letter-spacing: -0.3px; }
        .header-company { font-size: 11px; opacity: 0.85; margin-top: 2px; }
        .header-right { text-align: right; font-size: 10px; }
        .header-right div { margin-bottom: 2px; }
        .header-id { font-size: 9px; opacity: 0.6; font-family: monospace; }

        /* Info Grid */
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .info-cell { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        .info-cell:nth-child(3n+2) { border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
        .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
        .info-value { font-size: 11px; font-weight: 600; color: #0f172a; margin-top: 1px; }

        /* Health Score */
        .health-container { display: flex; gap: 16px; align-items: flex-start; margin-top: 8px; }
        .health-score-box { width: 120px; text-align: center; padding: 12px; border-radius: 8px; flex-shrink: 0; }
        .health-number { font-size: 36px; font-weight: 800; line-height: 1; }
        .health-label { font-size: 10px; font-weight: 600; margin-top: 4px; }
        .health-bars { flex: 1; }
        .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .bar-label { width: 110px; font-size: 10px; color: #475569; }
        .bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
        .bar-pct { width: 35px; text-align: right; font-size: 10px; font-weight: 700; }

        /* Priority Summary */
        .priority-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        .priority-card { border-radius: 6px; padding: 8px 10px; }
        .priority-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .priority-count { font-size: 20px; font-weight: 800; margin-top: 2px; }
        .priority-items { margin-top: 4px; }
        .priority-item { font-size: 10px; padding: 2px 0; border-top: 1px solid rgba(0,0,0,0.06); }

        /* Findings Table */
        .findings-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .findings-table th { background: #f8fafc; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        .findings-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10px; }
        .findings-table tr:last-child td { border-bottom: none; }
        .severity-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        .finding-detail { margin-top: 8px; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #0891b2; }
        .finding-detail p { margin: 2px 0; font-size: 10px; }
        .finding-evidence { margin-top: 6px; }
        .finding-evidence img { width: 180px; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; }

        /* Process Checks */
        .checks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        .check-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
        .check-header { display: flex; justify-content: space-between; align-items: center; }
        .check-name { font-size: 11px; font-weight: 600; }
        .check-status { padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; color: white; }
        .check-evidence { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
        .check-evidence img { width: 80px; height: 55px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; }

        /* Gallery */
        .gallery { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 8px; }
        .gallery-card { text-align: center; }
        .gallery-card img { width: 100%; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; }
        .gallery-label { font-size: 8px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; }

        /* Issues */
        .issue-item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; align-items: flex-start; }
        .issue-item img { width: 80px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; }

        /* Summary */
        .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px 14px; margin-top: 8px; font-size: 11px; color: #0c4a6e; line-height: 1.6; }

        /* Footer */
        .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px; }

        /* Alert banner */
        .alert { padding: 8px 12px; border-radius: 6px; margin-top: 8px; font-size: 10px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
        .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            ${payload.companyLogo
              ? `<img class="logo" src="${payload.companyLogo}" alt="logo" />`
              : `<div class="logo" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:#0f172a;font-weight:700;">LOGO</div>`
            }
            <div>
              <div class="header-title">Vehicle Inspection Report</div>
              <div class="header-company">${escapeHtml(payload.companyName)} | ${escapeHtml(payload.companyPhone)}</div>
            </div>
          </div>
          <div class="header-right">
            <div style="font-weight:600;">${escapeHtml(payload.inspectionDate)}</div>
            <div class="header-id">ID: ${escapeHtml(payload.inspectionId)}</div>
            <div style="margin-top:4px;padding:2px 8px;background:rgba(255,255,255,0.15);border-radius:4px;display:inline-block;font-weight:600;">${escapeHtml(payload.status?.toUpperCase?.() ?? "PENDING")}</div>
          </div>
        </div>

        <!-- Vehicle & Customer Info -->
        <div class="info-grid">
          <div class="info-cell"><div class="info-label">Customer</div><div class="info-value">${escapeHtml(payload.customerName)}</div></div>
          <div class="info-cell"><div class="info-label">Vehicle</div><div class="info-value">${escapeHtml(payload.vehicleText)}</div></div>
          <div class="info-cell"><div class="info-label">Plate</div><div class="info-value">${escapeHtml(payload.plate || "-")}</div></div>
          <div class="info-cell"><div class="info-label">VIN</div><div class="info-value" style="font-family:monospace;font-size:10px;">${escapeHtml(payload.vin)}</div></div>
          <div class="info-cell"><div class="info-label">Mileage</div><div class="info-value">${escapeHtml(payload.mileage)} km</div></div>
          <div class="info-cell"><div class="info-label">Inspector</div><div class="info-value">${escapeHtml(payload.inspectorName)}</div></div>
        </div>

        ${safetyCount > 0 ? `<div class="alert alert-danger">WARNING: ${safetyCount} safety risk issue(s) found requiring immediate attention.</div>` : ""}
        ${mandatoryCount > 0 && safetyCount === 0 ? `<div class="alert alert-warning">${mandatoryCount} mandatory repair item(s) identified.</div>` : ""}
        ${safetyCount === 0 && mandatoryCount === 0 ? `<div class="alert alert-success">No critical issues found. Vehicle is in good condition.</div>` : ""}

        <!-- Vehicle Photos -->
        ${payload.gallery.length ? `
        <div class="section">
          <h2>Vehicle Overview Photos</h2>
          <div class="gallery">
            ${payload.gallery.map((g) => `<div class="gallery-card"><img src="${g.url}" alt="${escapeHtml(g.label)}" /><div class="gallery-label">${escapeHtml(g.label)}</div></div>`).join("")}
          </div>
        </div>` : ""}

        <!-- Health Score -->
        <div class="section">
          <h2>Overall Vehicle Health</h2>
          <div class="health-container">
            <div class="health-score-box" style="background:${healthColor(payload.overallHealth)}15;">
              <div class="health-number" style="color:${healthColor(payload.overallHealth)}">${payload.overallHealth}%</div>
              <div class="health-label" style="color:${healthColor(payload.overallHealth)}">${healthLabel(payload.overallHealth)}</div>
            </div>
            <div class="health-bars">
              ${payload.categoryHealth.map((c) => `
                <div class="bar-row">
                  <div class="bar-label">${escapeHtml(c.label)}</div>
                  <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, c.health))}%;background:${healthColor(c.health)}"></div></div>
                  <div class="bar-pct" style="color:${healthColor(c.health)}">${c.health}%</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Priority Issues -->
        <div class="section">
          <h2>Priority Issues Summary</h2>
          <div class="priority-grid">
            ${(["Safety Risk", "Mandatory", "Recommended", "Optional"] as const).map((level) => {
              const items = payload.priority[level];
              const color = severityColor(level);
              const bg = severityBg(level);
              return `<div class="priority-card" style="background:${bg};border-left:3px solid ${color};">
                <div class="priority-title" style="color:${color}">${level}</div>
                <div class="priority-count" style="color:${color}">${items.length}</div>
                ${items.length ? `<div class="priority-items">${items.map((item) => `<div class="priority-item">${escapeHtml(item.part)} <span class="muted">(${escapeHtml(item.group)})</span></div>`).join("")}</div>` : `<div class="muted" style="margin-top:4px;">No items</div>`}
              </div>`;
            }).join("")}
          </div>
        </div>

        <!-- Findings Detail -->
        ${payload.findings.length ? `
        <div class="section">
          <h2>Detailed Inspection Findings</h2>
          <table class="findings-table">
            <thead><tr><th style="width:25%">Part</th><th>Group</th><th>Severity</th><th>Condition</th><th>Action Required</th></tr></thead>
            <tbody>
              ${payload.findings.map((f) => `
                <tr>
                  <td><strong>${escapeHtml(f.part)}</strong>${f.partNumber ? `<br><span class="muted">#${escapeHtml(f.partNumber)}</span>` : ""}</td>
                  <td>${escapeHtml(f.group)}</td>
                  <td><span class="severity-badge" style="background:${severityBg(f.severity)};color:${severityColor(f.severity)}">${escapeHtml(f.severity)}</span></td>
                  <td>${escapeHtml(f.observed)}</td>
                  <td>${escapeHtml(f.action)}</td>
                </tr>
                ${f.evidenceUrl ? `<tr><td colspan="5" class="finding-evidence"><img src="${f.evidenceUrl}" alt="evidence" /></td></tr>` : ""}
              `).join("")}
            </tbody>
          </table>
        </div>` : ""}

        <!-- Inspection Checks -->
        <div class="section">
          <h2>Inspection Checks</h2>
          <div class="checks-grid">
            ${payload.processChecks.map((check) => `
              <div class="check-card">
                <div class="check-header">
                  <span class="check-name">${escapeHtml(check.label)}</span>
                  <span class="check-status" style="background:${checkStatusColor(check.status)}">${escapeHtml(check.status || "N/A")}</span>
                </div>
                ${check.note ? `<div class="muted" style="margin-top:4px;">${escapeHtml(check.note)}</div>` : ""}
                ${(check.evidenceUrls ?? []).length ? `<div class="check-evidence">${check.evidenceUrls.map((url) => `<img src="${url}" alt="check" />`).join("")}</div>` : ""}
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Tyre & Input Info -->
        <div class="section">
          <h2>Vehicle Inputs</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;">
            <div><span class="muted">Tyre Front:</span> <strong>${escapeHtml(payload.tyreSizeFront || "-")}</strong></div>
            <div><span class="muted">Tyre Rear:</span> <strong>${escapeHtml(payload.tyreSizeRear || "-")}</strong></div>
            <div><span class="muted">Customer Complaint:</span> ${escapeHtml(payload.customerComplain || "None")}</div>
            <div><span class="muted">Inspector Remarks:</span> ${escapeHtml(payload.inspectorRemarks || "None")}</div>
          </div>
        </div>

        <!-- Issues / Damages -->
        ${payload.issueEntries.length ? `
        <div class="section">
          <h2>Issues / Damages Notes</h2>
          ${payload.issueEntries.map((issue) => `
            <div class="issue-item">
              ${issue.evidenceUrl ? `<img src="${issue.evidenceUrl}" alt="issue" />` : ""}
              <div>${escapeHtml(issue.description || "-")}</div>
            </div>
          `).join("")}
        </div>` : ""}

        <!-- Summary -->
        <div class="section">
          <h2>Inspection Summary</h2>
          <div class="summary-box">${escapeHtml(payload.summaryText)}</div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div>${escapeHtml(payload.companyName)} | ${escapeHtml(payload.companyEmail)}</div>
          <div>Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
        </div>
      </div>
    </body>
  </html>`;
}

async function buildInspectionFallbackPdf(payload: {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  inspectionId: string;
  status: string;
  startAt: string;
  completedAt: string;
  customerName: string;
  customerPhone: string;
  carPlate: string;
  carModel: string;
  advisorRemark: string;
  customerRemark: string;
  inspectorRemark: string;
  health: Array<{ label: string; value: string }>;
  findings: Array<{ productName: string; qty: string; status: string; reason: string }>;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595.28, 841.89]); // A4
  const margin = 40;
  let y = 800;
  const lineHeight = 15;

  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    y = 800;
  };
  const drawLine = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    if (y < 60) newPage();
    const safe = toPdfSafeText(text);
    page.drawText(safe, {
      x: margin,
      y,
      size: opts?.size ?? 10,
      font: opts?.bold ? fontBold : font,
      color: opts?.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0.1, 0.12, 0.16),
    });
    y -= lineHeight;
  };

  drawLine("Vehicle Inspection Report", { bold: true, size: 16, color: [0.02, 0.27, 0.49] });
  drawLine(toPdfSafeText(payload.companyName), { bold: true, size: 11 });
  drawLine(
    `${toPdfSafeText(payload.companyAddress)} | ${toPdfSafeText(payload.companyPhone)} | ${toPdfSafeText(payload.companyEmail)}`,
    { size: 9 }
  );
  y -= 5;
  drawLine(`Inspection ID: ${toPdfSafeText(payload.inspectionId)} | Status: ${toPdfSafeText(titleize(payload.status))}`, { bold: true });
  drawLine(`Started: ${toPdfSafeText(payload.startAt)} | Completed: ${toPdfSafeText(payload.completedAt)}`);

  y -= 8;
  drawLine("Customer & Vehicle", { bold: true, size: 12, color: [0.02, 0.27, 0.49] });
  drawLine(`Customer: ${toPdfSafeText(payload.customerName)} | Phone: ${toPdfSafeText(payload.customerPhone)}`);
  drawLine(`Car: ${toPdfSafeText(payload.carModel)} | Plate: ${toPdfSafeText(payload.carPlate)}`);

  y -= 8;
  drawLine("Health Summary", { bold: true, size: 12, color: [0.02, 0.27, 0.49] });
  for (const row of payload.health) {
    drawLine(`- ${toPdfSafeText(row.label)}: ${toPdfSafeText(row.value)}`);
  }

  y -= 8;
  drawLine("Findings / Parts Needed", { bold: true, size: 12, color: [0.02, 0.27, 0.49] });
  if (!payload.findings.length) {
    drawLine("- No findings.");
  } else {
    payload.findings.slice(0, 40).forEach((f, i) => {
      drawLine(
        `${i + 1}. ${toPdfSafeText(f.productName)} | Qty: ${toPdfSafeText(f.qty)} | ${toPdfSafeText(f.status)} | ${toPdfSafeText(f.reason)}`
      );
    });
    if (payload.findings.length > 40) {
      drawLine(`...and ${payload.findings.length - 40} more item(s).`);
    }
  }

  y -= 8;
  drawLine("Remarks", { bold: true, size: 12, color: [0.02, 0.27, 0.49] });
  drawLine(`Customer Complaint: ${toPdfSafeText(payload.customerRemark || "-")}`);
  drawLine(`Advisor Remark: ${toPdfSafeText(payload.advisorRemark || "-")}`);
  drawLine(`Inspector Remark: ${toPdfSafeText(payload.inspectorRemark || "-")}`);

  const totalPages = pdf.getPageCount();
  for (let i = 0; i < totalPages; i += 1) {
    const p = pdf.getPage(i);
    p.drawText(`Page ${i + 1} / ${totalPages}`, {
      x: 500,
      y: 20,
      size: 9,
      font,
      color: rgb(0.35, 0.4, 0.47),
    });
  }

  return await pdf.save();
}

export async function GET(_req: NextRequest, { params }: Params) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let inspectionIdSafe = "unknown";
  const safeResolve = async <T,>(loader: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await loader();
    } catch {
      return fallback;
    }
  };
  try {
    const { companyId, inspectionId } = await params;
    inspectionIdSafe = String(inspectionId || "unknown");
    const inspection = await getInspectionById(companyId, inspectionId);
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }
    const sql = getSql();
    const collectCarSource = await resolveCollectCarSource(sql, companyId, inspection.leadId ?? null).catch(() => ({
      sourceType: "unknown" as CollectCarSourceType,
      sourceMedia: {} as Record<string, string>,
    }));

    const [company, customer, car, items, lineItems] = await Promise.all([
      safeResolve(() => Promise.resolve(getCompanyById(companyId)), null),
      inspection.customerId
        ? safeResolve(() => Promise.resolve(Crm.getCustomerById(inspection.customerId as any)), null)
        : Promise.resolve(null),
      inspection.carId
        ? safeResolve(() => Promise.resolve(Crm.getCarById(inspection.carId as any)), null)
        : Promise.resolve(null),
      safeResolve(() => Promise.resolve(listInspectionItems(inspectionId)), [] as any[]),
      safeResolve(() => Promise.resolve(listInspectionLineItems(inspectionId, { source: "inspection" })), [] as any[]),
    ]);

    const logoFileId = (company as any)?.logo_file_id ?? null;
    const readFileAsDataUrl = async (fileId: string | null | undefined) => {
      const id = String(fileId ?? "").trim();
      if (!id) return "";
      if (/^data:/i.test(id)) return id;
      if (/^https?:\/\//i.test(id)) return id;
      try {
        const record = await Files.getFileById(id);
        const storagePath = (record as any)?.storage_path ?? (record as any)?.storagePath;
        const mimeType = (record as any)?.mime_type ?? (record as any)?.mimeType ?? "image/jpeg";
        if (!storagePath) return "";
        const data = await fs.readFile(storagePath);
        return `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`;
      } catch {
        return "";
      }
    };
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

    const reportPayload = {
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
      customerName: String((customer as any)?.name ?? ((inspection as any)?.draftPayload as any)?.customerName ?? "-"),
      customerPhone: String((customer as any)?.phone ?? "-"),
      carPlate: String((car as any)?.plate_number ?? ((inspection as any)?.draftPayload as any)?.inspectionPlate ?? ((inspection as any)?.draftPayload as any)?.carPlate ?? "-"),
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
      findings: (lineItems ?? []).map((row) => {
        const rawReason = String((row as any)?.reason ?? (row as any)?.priority ?? "Recommended").trim();
        const normalizedReason = rawReason === "safety_risk" ? "Safety Risk"
          : rawReason === "mandatory" ? "Mandatory"
          : rawReason === "recommended" ? "Recommended"
          : rawReason === "optional" ? "Optional"
          : rawReason;
        return {
          productName: String((row as any)?.productName ?? (row as any)?.product_name ?? (row as any)?.part ?? (row as any)?.description ?? "-"),
          qty: String((row as any)?.quantity ?? "-"),
          status: titleize(String((row as any)?.status ?? "-")),
          reason: normalizedReason,
        };
      }),
    };
    const draft = ((inspection as any)?.draftPayload ?? {}) as any;
    const issueEntriesDraft: Array<{ id?: string; description?: string; imageFileId?: string }> = Array.isArray(draft?.inspectionIssueEntries)
      ? draft.inspectionIssueEntries
      : [];
    const draftPartRows = Array.isArray(draft?.parts) ? draft.parts : [];
    const mergedRawRows: any[] = (() => {
      const dbRows = Array.isArray(lineItems) ? lineItems : [];
      if (!draftPartRows.length) return dbRows;
      const keyOf = (r: any) =>
        `${String(r?.clientRowKey ?? r?.client_row_key ?? "").trim()}|${String(r?.partNumber ?? r?.part_number ?? r?.catalogPartCode ?? "").trim()}|${String(
          r?.productName ?? r?.product_name ?? r?.part ?? ""
        )
          .trim()
          .toLowerCase()}`;
      const map = new Map<string, any>();
      for (const r of dbRows) map.set(keyOf(r), r);
      for (const r of draftPartRows) {
        const key = keyOf(r);
        if (map.has(key)) {
          map.set(key, { ...map.get(key), ...r });
        } else {
          map.set(key, r);
        }
      }
      return Array.from(map.values());
    })();
    const partRows = mergedRawRows.map((row) => {
      const part = String((row as any)?.productName ?? (row as any)?.product_name ?? (row as any)?.part ?? "").trim() || String((row as any)?.description ?? "").trim() || "Item";
      const partNumber = String((row as any)?.partNumber ?? (row as any)?.catalogPartCode ?? "").trim();
      const rawGroupLabel =
        String((row as any)?.catalogGroupName ?? "").trim() ||
        String((row as any)?.groupName ?? "").trim() ||
        String((row as any)?.group_name ?? "").trim() ||
        groupLabelFromKey(String((row as any)?.catalogGroupKey ?? "").trim());
      const rawSeverity = String((row as any)?.reason ?? (row as any)?.priority ?? (row as any)?.status ?? "Recommended").trim();
      const severity = rawSeverity === "safety_risk" ? "Safety Risk"
        : rawSeverity === "mandatory" || rawSeverity === "Mandatory" ? "Mandatory"
        : rawSeverity === "recommended" || rawSeverity === "Recommended" ? "Recommended"
        : rawSeverity === "optional" || rawSeverity === "Optional" ? "Optional"
        : "Recommended";
      const observed = String((row as any)?.description ?? "").trim() || `${part} requires inspection attention.`;
      const category = mapGroupToCategory(rawGroupLabel, part, observed);
      const group = rawGroupLabel === "General" ? category : rawGroupLabel;
      const why =
        severity === "Safety Risk"
          ? `${part} may impact safe driving and should be addressed immediately.`
          : severity === "Mandatory"
          ? `${part} should be repaired soon to avoid larger failures.`
          : severity === "Recommended"
          ? `${part} has wear/condition that should be addressed to maintain performance.`
          : `${part} is optional/cosmetic and can be planned later.`;
      const action = String((row as any)?.aiRecommendation ?? "").trim() || `Inspect/repair ${part} and confirm condition after service.`;
      return {
        part,
        partNumber,
        group,
        severity,
        observed,
        why,
        action,
        mediaFileId: String((row as any)?.mediaFileId ?? (row as any)?.media_file_id ?? "").trim(),
      };
    });

    const grouped = new Map<string, { scores: number[] }>();
    const allCategories = [
      "Engine",
      "Transmission",
      "Brakes",
      "Suspension",
      "Steering",
      "Tires & Wheels",
      "Electrical",
      "Body & Exterior",
      "Interior",
      "Fluids / Maintenance",
    ];
    for (const row of partRows) {
      const key = mapGroupToCategory(row.group, row.part, row.observed);
      if (!grouped.has(key)) grouped.set(key, { scores: [] });
      grouped.get(key)!.scores.push(scoreForSeverity(row.severity));
    }
    const groupHealth = allCategories.map((label) => {
      const scores = grouped.get(label)?.scores ?? [];
      return {
        label,
        health: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100,
      };
    });
    const categorySeverityCounts = allCategories.map((label) => {
      const rows = partRows.filter((row) => mapGroupToCategory(row.group, row.part, row.observed) === label);
      return {
        label,
        counts: {
          safety: rows.filter((r) => r.severity === "Safety Risk").length,
          mandatory: rows.filter((r) => r.severity === "Mandatory").length,
          recommended: rows.filter((r) => r.severity === "Recommended").length,
          optional: rows.filter((r) => r.severity === "Optional").length,
        },
      };
    });
    let effectiveWeights: Record<string, number> = { ...CATEGORY_WEIGHTS };
    try {
      const allowed = await canUseAi("ai.workshop.inspection.health_score" as any, { companyId }).catch(() => true);
      const resolved = await getOpenAIClientForCompany(companyId);
      if (allowed && resolved.client) {
        const prompt = `
You are calculating weighted overall vehicle health for inspection reporting.
Return strict JSON only:
{
  "weights": {
    "Engine": number,
    "Transmission": number,
    "Brakes": number,
    "Suspension": number,
    "Steering": number,
    "Tires & Wheels": number,
    "Electrical": number,
    "Body & Exterior": number,
    "Interior": number,
    "Fluids / Maintenance": number
  }
}

Rules:
- Weights are percentages and should total near 100.
- Safety-critical systems must have higher weight (Brakes, Engine, Steering, Suspension, Tires).
- Interior and Fluids should have lower impact.
- Use this inspection context:
categoryHealth=${JSON.stringify(groupHealth)}
severityCounts=${JSON.stringify(categorySeverityCounts)}
`;
        const completion = await resolved.client.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(String(completion.choices[0]?.message?.content ?? "{}")) as {
          weights?: Record<string, number>;
        };
        const aiWeights = parsed?.weights ?? {};
        const validated: Record<string, number> = {};
        for (const key of allCategories) {
          const n = Number(aiWeights[key]);
          validated[key] = Number.isFinite(n) && n > 0 ? n : CATEGORY_WEIGHTS[key];
        }
        const sum = Object.values(validated).reduce((a, b) => a + b, 0);
        if (sum > 0) {
          effectiveWeights = Object.fromEntries(
            Object.entries(validated).map(([k, v]) => [k, (v / sum) * 100])
          );
        }
      }
    } catch {
      effectiveWeights = { ...CATEGORY_WEIGHTS };
    }
    const overallHealth = computeWeightedOverallHealth(groupHealth, effectiveWeights);

    const priority = {
      "Safety Risk": partRows.filter((r) => r.severity === "Safety Risk").map((r) => ({ part: r.part, group: r.group, note: r.observed })),
      Mandatory: partRows.filter((r) => r.severity === "Mandatory").map((r) => ({ part: r.part, group: r.group, note: r.observed })),
      Recommended: partRows.filter((r) => r.severity === "Recommended").map((r) => ({ part: r.part, group: r.group, note: r.observed })),
      Optional: partRows.filter((r) => r.severity === "Optional").map((r) => ({ part: r.part, group: r.group, note: r.observed })),
    };

    const safetyCount = priority["Safety Risk"].length;
    const mandatoryCount = priority.Mandatory.length;
    const recommendedCount = priority.Recommended.length;
    const optionalCount = priority.Optional.length;
    const summaryText = `The vehicle was inspected across key systems. Overall health score is ${overallHealth}%. ${
      safetyCount > 0 ? `${safetyCount} safety issue(s) require immediate attention.` : "No immediate safety-risk items were found."
    } ${
      mandatoryCount > 0 ? `${mandatoryCount} mandatory repair item(s) should be addressed soon.` : "No mandatory repair items are pending."
    } ${
      recommendedCount > 0 ? `${recommendedCount} recommended maintenance item(s) were identified.` : "No additional recommended maintenance items were identified."
    } ${
      optionalCount > 0 ? `${optionalCount} optional/cosmetic item(s) were noted.` : "No optional/cosmetic items were recorded."
    }`;

    const pickMediaId = (...values: unknown[]) => {
      for (const value of values) {
        const out = String(value ?? "").trim();
        if (out && out !== "null" && out !== "undefined") return out;
      }
      return "";
    };
    const galleryFileIds = [
      {
        label: "Front View",
        id: pickMediaId(
          draft?.carMediaReplacement?.front,
          draft?.collectCarReview?.reuploadMedia?.front,
          draft?.collectCarReview?.sourceMedia?.front,
          collectCarSource.sourceMedia?.front
        ),
      },
      {
        label: "Rear View",
        id: pickMediaId(
          draft?.carMediaReplacement?.rear,
          draft?.collectCarReview?.reuploadMedia?.rear,
          draft?.collectCarReview?.sourceMedia?.rear,
          collectCarSource.sourceMedia?.rear
        ),
      },
      {
        label: "Odometer",
        id: pickMediaId(
          draft?.clusterImageId,
          draft?.collectCarReview?.sourceMedia?.cluster,
          collectCarSource.sourceMedia?.cluster
        ),
      },
      {
        label: "Left Side",
        id: pickMediaId(
          draft?.carMediaReplacement?.left,
          draft?.collectCarReview?.reuploadMedia?.left,
          draft?.collectCarReview?.sourceMedia?.left,
          collectCarSource.sourceMedia?.left
        ),
      },
      {
        label: "Right Side",
        id: pickMediaId(
          draft?.carMediaReplacement?.right,
          draft?.collectCarReview?.reuploadMedia?.right,
          draft?.collectCarReview?.sourceMedia?.right,
          collectCarSource.sourceMedia?.right
        ),
      },
    ];
    const galleryResolved = await Promise.all(
      galleryFileIds.map(async (g) => ({ label: g.label, url: await readFileAsDataUrl(g.id) }))
    );
    const gallery = galleryResolved.filter((g) => Boolean(g.url));

    const issueEvidenceMap = new Map<string, string>();
    await Promise.all(
      issueEntriesDraft.map(async (entry, idx) => {
        const url = await readFileAsDataUrl(String(entry?.imageFileId ?? ""));
        if (url) issueEvidenceMap.set(String(idx), url);
      })
    );
    const findingsWithEvidence = await Promise.all(
      partRows.map(async (r) => {
        // Try mediaFileId first, then first entry in mediaFiles array from draft
        let mediaId = r.mediaFileId;
        if (!mediaId) {
          const draftRow = draftPartRows.find((dp: any) => {
            const dpName = String(dp?.part ?? dp?.productName ?? "").trim().toLowerCase();
            return dpName && dpName === r.part.trim().toLowerCase();
          });
          if (draftRow) {
            mediaId = String(draftRow?.mediaFileId ?? "").trim();
            if (!mediaId && Array.isArray(draftRow?.mediaFiles) && draftRow.mediaFiles.length > 0) {
              mediaId = String(draftRow.mediaFiles[0]?.id ?? "").trim();
            }
          }
        }
        const rowEvidence = await readFileAsDataUrl(mediaId);
        let fallbackIssueUrl = "";
        if (!rowEvidence) {
          const partLower = String(r.part ?? "").toLowerCase().trim();
          const matched = issueEntriesDraft.find((entry) => {
            const desc = String(entry?.description ?? "").toLowerCase().trim();
            return partLower && desc && (desc.includes(partLower) || partLower.includes(desc));
          });
          if (matched) {
            fallbackIssueUrl = await readFileAsDataUrl(String(matched.imageFileId ?? ""));
          } else if (issueEntriesDraft[0]?.imageFileId) {
            fallbackIssueUrl = await readFileAsDataUrl(String(issueEntriesDraft[0].imageFileId ?? ""));
          }
        }
        return {
          part: r.part,
          partNumber: r.partNumber,
          group: r.group,
          severity: r.severity,
          observed: r.observed,
          why: r.why,
          action: r.action,
          evidenceUrl: rowEvidence || fallbackIssueUrl,
        };
      })
    );

    const processChecks = await Promise.all(
      [
        { key: "oil", label: "Oil Check" },
        { key: "battery", label: "Battery Check" },
        { key: "tyre", label: "Tyre Check" },
        { key: "obd", label: "OBD Check" },
      ].map(async (entry) => {
        const multiIds = Array.isArray(draft?.processCheckMediaMulti?.[entry.key])
          ? (draft.processCheckMediaMulti[entry.key] as any[]).map((x) => String(x ?? "").trim()).filter(Boolean)
          : [];
        const singleId = String(draft?.processCheckMedia?.[entry.key] ?? "").trim();
        const mediaIds = Array.from(new Set([...(multiIds ?? []), ...(singleId ? [singleId] : [])]));
        const evidenceUrls = (
          await Promise.all(mediaIds.map(async (id) => await readFileAsDataUrl(id)))
        ).filter(Boolean);
        return {
          label: entry.label,
          status: String(draft?.processChecks?.[entry.key] ?? draft?.checks?.[entry.key] ?? "").toUpperCase(),
          note: String(draft?.processCheckIssueNotes?.[entry.key] ?? ""),
          evidenceUrls,
        };
      })
    );

    const issueEntries = await Promise.all(
      issueEntriesDraft.map(async (entry) => ({
        description: String(entry?.description ?? ""),
        evidenceUrl: await readFileAsDataUrl(String(entry?.imageFileId ?? "")),
      }))
    );

    const premiumPayload = {
      companyName: reportPayload.companyName,
      companyAddress: reportPayload.companyAddress,
      companyPhone: reportPayload.companyPhone,
      companyEmail: reportPayload.companyEmail,
      companyLogo,
      status: reportPayload.status,
      inspectionId: reportPayload.inspectionId,
      inspectionDate: formatDateOnly(inspection.completeAt ?? inspection.startAt ?? inspection.createdAt),
      customerName: reportPayload.customerName !== "-" ? reportPayload.customerName : String(draft?.customerName ?? "-"),
      vehicleText: `${String((car as any)?.make ?? draft?.inspectionMake ?? "")} ${String((car as any)?.model ?? draft?.inspectionModel ?? "")} ${String(draft?.inspectionYear ?? "")}`.trim() || reportPayload.carModel,
      vin: String(draft?.inspectionVin ?? (car as any)?.vin ?? "-"),
      plate: reportPayload.carPlate !== "-" ? reportPayload.carPlate : String(draft?.inspectionPlate ?? draft?.carPlate ?? "-"),
      mileage: String(draft?.carInMileage ?? (car as any)?.mileage ?? "-"),
      tyreSizeFront: String(draft?.tyreSizeFront ?? "-"),
      tyreSizeRear: String(draft?.tyreSizeRear ?? "-"),
      inspectorName: String(draft?.inspectorName ?? inspection.inspectorRemark ?? "-"),
      inspectorRemarks: String(draft?.inspectorRemarks ?? inspection.inspectorRemark ?? "-"),
      customerComplain: String(draft?.customerComplain ?? inspection.customerRemark ?? "-"),
      processChecks,
      issueEntries,
      gallery,
      overallHealth,
      categoryHealth: groupHealth,
      priority,
      findings: findingsWithEvidence,
      summaryText,
    };

    const html = buildPremiumInspectionHtml(premiumPayload);

    try {
      browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"], headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await page.close();
      await browser.close();
      browser = null;

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="inspection-${inspection.id}.pdf"`,
        },
      });
    } catch (pdfError) {
      if (browser) {
        try {
          await browser.close();
        } catch {}
        browser = null;
      }
      console.error("Inspection PDF primary renderer failed, using fallback:", pdfError);
      try {
        const fallbackPdf = await buildInspectionFallbackPdf(reportPayload);
        return new NextResponse(fallbackPdf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="inspection-${inspection.id}.pdf"`,
            "X-PDF-Renderer": "pdf-lib-fallback",
          },
        });
      } catch (fallbackErr) {
        console.error("Inspection PDF fallback renderer failed:", fallbackErr);
        const emergencyPdf = await PDFDocument.create();
        const page = emergencyPdf.addPage([595.28, 841.89]);
        const font = await emergencyPdf.embedFont(StandardFonts.HelveticaBold);
        page.drawText("Inspection Report", { x: 40, y: 790, size: 20, font, color: rgb(0.1, 0.12, 0.16) });
        page.drawText(`Inspection ID: ${toPdfSafeText(String(inspection.id))}`, {
          x: 40,
          y: 760,
          size: 12,
          font,
          color: rgb(0.1, 0.12, 0.16),
        });
        page.drawText("PDF generated in safe mode. Please retry for full layout.", {
          x: 40,
          y: 736,
          size: 10,
          font,
          color: rgb(0.45, 0.1, 0.1),
        });
        const bytes = await emergencyPdf.save();
        return new NextResponse(bytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="inspection-${inspection.id}.pdf"`,
            "X-PDF-Renderer": "pdf-lib-emergency",
          },
        });
      }
    }
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    console.error("GET /api/company/[companyId]/workshop/inspections/[inspectionId]/print error:", error);
    try {
      const emergencyPdf = await PDFDocument.create();
      const page = emergencyPdf.addPage([595.28, 841.89]);
      const font = await emergencyPdf.embedFont(StandardFonts.HelveticaBold);
      page.drawText("Inspection Report", {
        x: 40,
        y: 790,
        size: 20,
        font,
        color: rgb(0.1, 0.12, 0.16),
      });
      page.drawText(`Inspection ID: ${toPdfSafeText(inspectionIdSafe)}`, {
        x: 40,
        y: 760,
        size: 12,
        font,
        color: rgb(0.1, 0.12, 0.16),
      });
      page.drawText("PDF generated in emergency mode due to server rendering issue.", {
        x: 40,
        y: 736,
        size: 10,
        font,
        color: rgb(0.45, 0.1, 0.1),
      });
      page.drawText("Please contact support and share server logs for full report rendering.", {
        x: 40,
        y: 720,
        size: 10,
        font,
        color: rgb(0.45, 0.1, 0.1),
      });
      const bytes = await emergencyPdf.save();
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="inspection-${inspectionIdSafe}.pdf"`,
          "X-PDF-Renderer": "pdf-lib-emergency-global",
        },
      });
    } catch (finalErr) {
      console.error("Final emergency PDF generation failed:", finalErr);
      return new NextResponse("Failed to generate inspection PDF", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }
}
