import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { canUseAi, Crm, Files, getOpenAIClientForCompany } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";
import { getSql } from "@repo/ai-core/db";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  getInspectionById,
  listInspectionItems,
  listInspectionLineItems,
} from "@repo/ai-core/workshop/inspections/repository";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };
type CollectCarSourceType = "recovery" | "walkin" | "unknown";

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

function normalizeFileId(value: unknown): string | null {
  const out = String(value ?? "").trim();
  return out || null;
}

function normalizeMediaMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const keys = ["video", "front", "rear", "right", "left", "cluster"] as const;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const id = normalizeFileId(row[key]);
    if (id) out[key] = id;
  }
  return out;
}

async function resolveCollectCarSource(sql: any, companyId: string, leadId: string | null | undefined): Promise<{
  sourceType: CollectCarSourceType;
  sourceMedia: Record<string, string>;
}> {
  if (!leadId) return { sourceType: "unknown", sourceMedia: {} };
  const leadRows = await sql<any[]>`
    SELECT
      lead_type,
      workshop_visit_mode,
      pickup_from,
      dropoff_to,
      carin_video,
      workflow_required
    FROM leads
    WHERE company_id = ${companyId}
      AND id = ${leadId}
    LIMIT 1
  `;
  const leadRow = ((leadRows as any).rows ?? leadRows)?.[0];
  if (!leadRow) return { sourceType: "unknown", sourceMedia: {} };

  const isRecovery =
    String(leadRow.lead_type ?? "").toLowerCase() === "recovery" ||
    String(leadRow.workshop_visit_mode ?? "").toLowerCase() === "recovery" ||
    Boolean(String(leadRow.pickup_from ?? "").trim()) ||
    Boolean(String(leadRow.dropoff_to ?? "").trim());

  if (isRecovery) {
    const recoveryRows = await sql<any[]>`
      SELECT
        pickup_video,
        pickup_front_image,
        pickup_rear_image,
        pickup_right_image,
        pickup_left_image,
        pickup_cluster_image
      FROM recovery_requests
      WHERE lead_id = ${leadId}
        AND type = 'pickup'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const recoveryRow = ((recoveryRows as any).rows ?? recoveryRows)?.[0];
    const media = normalizeMediaMap({
      video: recoveryRow?.pickup_video ?? null,
      front: recoveryRow?.pickup_front_image ?? null,
      rear: recoveryRow?.pickup_rear_image ?? null,
      right: recoveryRow?.pickup_right_image ?? null,
      left: recoveryRow?.pickup_left_image ?? null,
      cluster: recoveryRow?.pickup_cluster_image ?? null,
    });
    return { sourceType: "recovery", sourceMedia: media };
  }

  const workflowRequired = (leadRow.workflow_required ?? {}) as Record<string, unknown>;
  const media = normalizeMediaMap({
    video: leadRow.carin_video ?? workflowRequired.inspectionVideo360 ?? null,
    front: workflowRequired.inspectionPhotoFront ?? null,
    rear: workflowRequired.inspectionPhotoRear ?? null,
    right: workflowRequired.inspectionPhotoRight ?? null,
    left: workflowRequired.inspectionPhotoLeft ?? null,
    cluster: workflowRequired.inspectionClusterImage ?? null,
  });
  return { sourceType: "walkin", sourceMedia: media };
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

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Vehicle Inspection Report</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; font-size: 12px; }
        .report { border: 1px solid #dbe2ea; border-radius: 10px; padding: 14px; }
        .section { border: 1px solid #dbe2ea; border-radius: 8px; padding: 10px; margin-top: 10px; page-break-inside: avoid; }
        .title { font-size: 18px; font-weight: 700; }
        .muted { color: #475569; font-size: 11px; }
        .header { display: flex; justify-content: space-between; gap: 10px; }
        .brand { display: flex; gap: 10px; align-items: center; }
        .logo { width: 56px; height: 56px; border: 1px solid #dbe2ea; border-radius: 8px; object-fit: contain; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-top: 8px; }
        .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .gallery-card { border: 1px solid #dbe2ea; border-radius: 8px; padding: 6px; }
        .gallery-card img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; }
        .health-grid { display: grid; grid-template-columns: 180px 1fr; gap: 10px; }
        .score { font-size: 32px; font-weight: 700; color: #0b4a6f; }
        .bar-wrap { margin-top: 5px; }
        .bar-head { display: flex; justify-content: space-between; font-size: 11px; }
        .bar { height: 6px; border-radius: 99px; background: #e2e8f0; overflow: hidden; }
        .bar > div { height: 100%; background: #0891b2; }
        .priority-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .box { border: 1px solid #dbe2ea; border-radius: 8px; padding: 8px; }
        .box h4 { margin: 0 0 6px; font-size: 12px; }
        .item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin-top: 6px; }
        .item-title { font-weight: 600; }
        .finding { border: 1px solid #dbe2ea; border-radius: 8px; padding: 8px; margin-top: 8px; }
        .finding-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .chip { border: 1px solid #0891b2; color: #0b4a6f; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; }
        .evidence { width: 230px; max-width: 100%; height: 120px; border-radius: 6px; border: 1px solid #dbe2ea; object-fit: cover; margin-top: 4px; }
        .footer { margin-top: 8px; text-align: right; color: #64748b; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="report">
        <div class="section">
          <div class="header">
            <div class="brand">
              ${
                payload.companyLogo
                  ? `<img class="logo" src="${payload.companyLogo}" alt="logo" />`
                  : `<div class="logo" style="display:flex;align-items:center;justify-content:center;">LOGO</div>`
              }
              <div>
                <div class="title">Vehicle Inspection Report</div>
                <div><strong>${escapeHtml(payload.companyName)}</strong></div>
                <div class="muted">${escapeHtml(payload.companyAddress)}</div>
                <div class="muted">${escapeHtml(payload.companyPhone)} | ${escapeHtml(payload.companyEmail)}</div>
              </div>
            </div>
            <div>
              <div><strong>Inspection ID:</strong> ${escapeHtml(payload.inspectionId)}</div>
              <div><strong>Date:</strong> ${escapeHtml(payload.inspectionDate)}</div>
            </div>
          </div>
          <div class="meta-grid">
            <div><strong>Customer:</strong> ${escapeHtml(payload.customerName)}</div>
            <div><strong>Inspector:</strong> ${escapeHtml(payload.inspectorName)}</div>
            <div><strong>Vehicle:</strong> ${escapeHtml(payload.vehicleText)}</div>
            <div><strong>Mileage:</strong> ${escapeHtml(payload.mileage)}</div>
            <div><strong>VIN:</strong> ${escapeHtml(payload.vin)}</div>
            <div><strong>Plate:</strong> ${escapeHtml(payload.plate)}</div>
          </div>
        </div>

        <div class="section">
          <div><strong>Vehicle Overview Photos</strong></div>
          ${
            payload.gallery.length
              ? `<div class="gallery">
                  ${payload.gallery
                    .map(
                      (g) => `
                    <div class="gallery-card">
                      <div class="muted">${escapeHtml(g.label)}</div>
                      <img src="${g.url}" alt="${escapeHtml(g.label)}" />
                    </div>`
                    )
                    .join("")}
                </div>`
              : `<div class="muted">No check-in photos available.</div>`
          }
        </div>

        <div class="section">
          <div><strong>Vehicle Inspection Inputs</strong></div>
          <div class="meta-grid">
            <div><strong>Tyre Size (Front):</strong> ${escapeHtml(payload.tyreSizeFront || "-")}</div>
            <div><strong>Tyre Size (Rear):</strong> ${escapeHtml(payload.tyreSizeRear || "-")}</div>
            <div><strong>Customer Complaint:</strong> ${escapeHtml(payload.customerComplain || "-")}</div>
            <div><strong>Inspector Remarks:</strong> ${escapeHtml(payload.inspectorRemarks || "-")}</div>
          </div>
        </div>

        <div class="section">
          <div><strong>Overall Vehicle Health</strong></div>
          <div class="health-grid">
            <div>
              <div class="score">${payload.overallHealth}%</div>
              <div class="muted">${
                payload.overallHealth >= 85
                  ? "Excellent"
                  : payload.overallHealth >= 70
                  ? "Good"
                  : payload.overallHealth >= 50
                  ? "Needs Attention"
                  : "Critical"
              }</div>
            </div>
            <div>
              ${payload.categoryHealth
                .map(
                  (c) => `
                <div class="bar-wrap">
                  <div class="bar-head"><span>${escapeHtml(c.label)}</span><span>${c.health}%</span></div>
                  <div class="bar"><div style="width:${Math.max(0, Math.min(100, Number(c.health) || 0))}%"></div></div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>

        <div class="section">
          <div><strong>Priority Issues Summary</strong></div>
          <div class="priority-grid">
            ${prioritySection("Safety Risk", payload.priority["Safety Risk"])}
            ${prioritySection("Mandatory", payload.priority["Mandatory"])}
            ${prioritySection("Recommended", payload.priority["Recommended"])}
            ${prioritySection("Optional", payload.priority["Optional"])}
          </div>
        </div>

        <div class="section">
          <div><strong>Detailed Inspection Findings</strong></div>
          ${findingsRows}
        </div>

        <div class="section">
          <div><strong>Inspection Checks</strong></div>
          ${
            payload.processChecks.length
              ? payload.processChecks
                  .map(
                    (check) => `
                <div class="item">
                  <div class="item-title">${escapeHtml(check.label)} - ${escapeHtml(check.status || "-")}</div>
                  <div class="muted">${escapeHtml(check.note || "-")}</div>
                  ${
                    (check.evidenceUrls ?? []).length
                      ? `<div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px;">
                          ${check.evidenceUrls
                            .map(
                              (url) => `<img class="evidence" style="height:90px; width:160px;" src="${url}" alt="check evidence" />`
                            )
                            .join("")}
                        </div>`
                      : `<div class="muted">No check evidence image.</div>`
                  }
                </div>
              `
                  )
                  .join("")
              : `<div class="muted">No process check data.</div>`
          }
        </div>

        <div class="section">
          <div><strong>Issues / Damages Notes</strong></div>
          ${
            payload.issueEntries.length
              ? payload.issueEntries
                  .map(
                    (issue) => `
                <div class="item">
                  <div class="muted">${escapeHtml(issue.description || "-")}</div>
                  ${
                    issue.evidenceUrl
                      ? `<img class="evidence" src="${issue.evidenceUrl}" alt="issue evidence" />`
                      : `<div class="muted">No issue evidence image.</div>`
                  }
                </div>
              `
                  )
                  .join("")
              : `<div class="muted">No issue notes.</div>`
          }
        </div>

        <div class="section">
          <div><strong>Inspection Summary</strong></div>
          <div>${escapeHtml(payload.summaryText)}</div>
        </div>
        <div class="footer">Generated by system</div>
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

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

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
      const part = String((row as any)?.productName ?? "").trim() || String((row as any)?.description ?? "").trim() || "Item";
      const partNumber = String((row as any)?.partNumber ?? (row as any)?.catalogPartCode ?? "").trim();
      const rawGroupLabel =
        String((row as any)?.catalogGroupName ?? "").trim() ||
        String((row as any)?.groupName ?? "").trim() ||
        String((row as any)?.group_name ?? "").trim() ||
        groupLabelFromKey(String((row as any)?.catalogGroupKey ?? "").trim());
      const severity = String((row as any)?.reason ?? "Recommended");
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
        mediaFileId: String((row as any)?.mediaFileId ?? "").trim(),
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
        const rowEvidence = await readFileAsDataUrl(r.mediaFileId);
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
          status: String(draft?.processChecks?.[entry.key] ?? "").toUpperCase(),
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
      inspectionId: reportPayload.inspectionId,
      inspectionDate: formatDateOnly(inspection.completeAt ?? inspection.startAt ?? inspection.createdAt),
      customerName: reportPayload.customerName,
      vehicleText: `${String((car as any)?.make ?? draft?.inspectionMake ?? "")} ${String((car as any)?.model ?? draft?.inspectionModel ?? "")} ${String(draft?.inspectionYear ?? "")}`.trim() || reportPayload.carModel,
      vin: String(draft?.inspectionVin ?? (car as any)?.vin ?? "-"),
      plate: reportPayload.carPlate,
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
