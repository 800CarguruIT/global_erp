import { PDFDocument, StandardFonts, rgb } from "../node_modules/.pnpm/pdf-lib@1.17.1/node_modules/pdf-lib/cjs/index.js";
import { writeFileSync } from "fs";
import { resolve } from "path";

const GREEN      = rgb(0.094, 0.565, 0.196);
const DARK_GREEN = rgb(0.047, 0.376, 0.125);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const MED_GRAY   = rgb(0.75, 0.75, 0.75);
const DARK       = rgb(0.1,  0.1,  0.1);
const WHITE      = rgb(1,    1,    1);
const TEAL       = rgb(0.05, 0.45, 0.55);
const DARK_TEAL  = rgb(0.02, 0.28, 0.36);

const A4_W = 595, A4_H = 842;
const ML = 45, MR = 45, MT = 50;
const CW = A4_W - ML - MR;

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) { current = test; }
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

class Doc {
  constructor(pdfDoc, fonts) {
    this.pdf = pdfDoc; this.fonts = fonts; this.page = null; this.y = 0;
    this.addPage();
  }
  addPage() { this.page = this.pdf.addPage([A4_W, A4_H]); this.y = A4_H - MT; }
  ensureSpace(n) { if (this.y - n < 55) this.addPage(); }
  rect(x, y, w, h, color) { this.page.drawRectangle({ x, y, width: w, height: h, color }); }
  line(x1, y1, x2, y2, color = MED_GRAY, t = 0.5) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color });
  }
  txt(s, x, y, size, font, color = DARK) { this.page.drawText(String(s), { x, y, size, font, color }); }

  section(title, color = DARK_GREEN) {
    this.ensureSpace(32);
    this.y -= 12;
    this.txt(title, ML, this.y, 12, this.fonts.bold, color);
    this.y -= 5;
    this.line(ML, this.y, ML + CW, this.y, GREEN, 1.5);
    this.y -= 13;
  }
  sub(title) {
    this.ensureSpace(22);
    this.y -= 6;
    this.txt(title, ML, this.y, 10, this.fonts.bold, DARK);
    this.y -= 15;
  }
  para(txt, indent = 0, size = 9, color = DARK) {
    const lines = wrapText(txt, this.fonts.reg, size, CW - indent);
    this.ensureSpace(lines.length * 13 + 4);
    for (const line of lines) { this.txt(line, ML + indent, this.y, size, this.fonts.reg, color); this.y -= 13; }
    this.y -= 2;
  }
  bullet(txt, indent = 10, color = DARK) {
    const lines = wrapText(txt, this.fonts.reg, 9, CW - indent - 12);
    this.ensureSpace(lines.length * 13 + 2);
    this.txt("-", ML + indent, this.y, 9, this.fonts.bold, GREEN);
    for (let i = 0; i < lines.length; i++) {
      this.txt(lines[i], ML + indent + 12, this.y, 9, this.fonts.reg, color);
      this.y -= 13;
    }
    this.y -= 1;
  }
  step(num, title) {
    this.ensureSpace(24);
    this.y -= 9;
    this.rect(ML, this.y - 2, 18, 14, GREEN);
    this.txt(String(num), ML + (num < 10 ? 6 : 3), this.y, 9, this.fonts.bold, WHITE);
    this.txt(title, ML + 24, this.y, 10, this.fonts.bold, DARK);
    this.y -= 17;
  }
  filePath(path) {
    this.ensureSpace(17);
    this.rect(ML + 10, this.y - 3, CW - 10, 14, rgb(0.92, 0.97, 0.92));
    this.txt(path, ML + 14, this.y, 7.5, this.fonts.mono, DARK_GREEN);
    this.y -= 17;
  }
  // 2-col table
  table2(headers, rows, col1W = 200) {
    const col2W = CW - col1W, rowH = 16;
    this.ensureSpace(rowH * Math.min(rows.length + 1, 6));
    this.rect(ML, this.y - rowH + 4, CW, rowH, DARK_GREEN);
    this.txt(headers[0], ML + 4, this.y - 2, 8, this.fonts.bold, WHITE);
    this.txt(headers[1], ML + col1W + 4, this.y - 2, 8, this.fonts.bold, WHITE);
    this.y -= rowH;
    for (let i = 0; i < rows.length; i++) {
      if (this.y - rowH < 55) { this.addPage(); }
      this.rect(ML, this.y - rowH + 4, CW, rowH, i % 2 === 0 ? LIGHT_GRAY : WHITE);
      const l1 = wrapText(rows[i][0], this.fonts.reg, 7.5, col1W - 8);
      const l2 = wrapText(rows[i][1], this.fonts.reg, 7.5, col2W - 8);
      this.txt(l1[0] ?? "", ML + 4, this.y - 2, 7.5, this.fonts.reg, DARK);
      this.txt(l2[0] ?? "", ML + col1W + 4, this.y - 2, 7.5, this.fonts.reg, DARK);
      if (l1[1]) this.txt(l1[1], ML + 4, this.y - 10, 7.5, this.fonts.reg, DARK);
      if (l2[1]) this.txt(l2[1], ML + col1W + 4, this.y - 10, 7.5, this.fonts.reg, DARK);
      this.y -= rowH;
    }
    this.page.drawRectangle({ x: ML, y: this.y + 4, width: CW, height: rowH * (rows.length + 1), borderColor: MED_GRAY, borderWidth: 0.5 });
    this.y -= 8;
  }
  // 3-col table
  table3(headers, rows, c1W, c2W) {
    const c3W = CW - c1W - c2W, rowH = 16;
    this.ensureSpace(rowH * Math.min(rows.length + 1, 6));
    this.rect(ML, this.y - rowH + 4, CW, rowH, DARK_GREEN);
    [[0, ML], [1, ML + c1W], [2, ML + c1W + c2W]].forEach(([i, x]) =>
      this.txt(headers[i], x + 4, this.y - 2, 8, this.fonts.bold, WHITE));
    this.y -= rowH;
    for (let i = 0; i < rows.length; i++) {
      if (this.y - rowH < 55) { this.addPage(); }
      this.rect(ML, this.y - rowH + 4, CW, rowH, i % 2 === 0 ? LIGHT_GRAY : WHITE);
      [c1W, c2W, c3W].forEach((w, j) => {
        const x = ML + (j === 0 ? 0 : j === 1 ? c1W : c1W + c2W) + 4;
        this.txt(wrapText(rows[i][j], this.fonts.reg, 7.5, w - 8)[0] ?? "", x, this.y - 2, 7.5, this.fonts.reg, DARK);
      });
      this.y -= rowH;
    }
    this.page.drawRectangle({ x: ML, y: this.y + 4, width: CW, height: rowH * (rows.length + 1), borderColor: MED_GRAY, borderWidth: 0.5 });
    this.y -= 8;
  }
  // threshold admin table (3 cols: key, controls, default)
  thresholdTable(rows) {
    this.table3(["Threshold Key", "Controls", "Default"], rows, 165, 230);
  }
  addFooters() {
    const pages = this.pdf.getPages();
    pages.forEach((pg, i) => {
      pg.drawLine({ start: { x: ML, y: 36 }, end: { x: A4_W - MR, y: 36 }, thickness: 0.5, color: MED_GRAY });
      pg.drawText("Call Center Performance Dashboard - AI Enhancement Plan  |  Global ERP  |  March 26, 2026",
        { x: ML, y: 23, size: 7, font: this.fonts.reg, color: MED_GRAY });
      pg.drawText(`Page ${i + 1} of ${pages.length}`,
        { x: A4_W - MR - 48, y: 23, size: 7, font: this.fonts.reg, color: MED_GRAY });
    });
  }
}

async function generate() {
  const pdfDoc = await PDFDocument.create();
  const [reg, bold, mono] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
    pdfDoc.embedFont(StandardFonts.Courier),
  ]);
  const d = new Doc(pdfDoc, { reg, bold, mono });

  // ── COVER ────────────────────────────────────────────────────────────────
  d.rect(0, A4_H - 170, A4_W, 170, DARK_GREEN);
  d.txt("CALL CENTER", 50, A4_H - 65, 30, bold, WHITE);
  d.txt("Performance Summary Dashboard", 50, A4_H - 102, 18, reg, rgb(0.8, 1, 0.8));
  d.txt("AI Intelligence Layer  +  Admin-Controlled Thresholds", 50, A4_H - 128, 11, reg, rgb(0.7, 0.95, 0.7));
  d.txt("Enhancement Plan  v2", 50, A4_H - 148, 10, reg, rgb(0.6, 0.9, 0.6));
  d.y = A4_H - 205;
  d.para("Prepared for: Global ERP System", 0, 10, DARK);
  d.para("Date: March 26, 2026  |  Branch: ai_int", 0, 10, DARK);
  d.y -= 10;
  d.line(ML, d.y, ML + CW, d.y, MED_GRAY, 1);
  d.y -= 20;

  // ── TABLE OF CONTENTS ────────────────────────────────────────────────────
  d.section("Contents");
  const toc = [
    ["1", "Executive Summary"],
    ["2", "Dashboard Gap Analysis"],
    ["3", "6 KPI Summary Cards"],
    ["4", "New AI Engine e8: Call Center Performance Intelligence"],
    ["5", "Implementation Steps (1-9)"],
    ["6", "Admin Panel - Performance Thresholds Settings"],
    ["7", "Admin-Controlled Threshold Reference Table"],
    ["8", "Visual Design & Colour Coding"],
    ["9", "Suggested KPIs for Future Enhancement"],
    ["10", "Critical Files Reference"],
    ["11", "Verification Steps"],
  ];
  for (const [n, label] of toc) {
    d.ensureSpace(14);
    d.txt(n + ".", ML + 5, d.y, 9, bold, DARK_GREEN);
    d.txt(label, ML + 22, d.y, 9, reg, DARK);
    d.y -= 14;
  }

  // ── 1. EXECUTIVE SUMMARY ─────────────────────────────────────────────────
  d.addPage();
  d.section("1. Executive Summary");
  d.para("The existing 'Today Call Center Summary' displays per-agent call and CRM metrics in a flat table with no computed ratios, no KPI cards, no trend comparison, no AI-powered insights, and all measurement thresholds hardcoded in code.");
  d.para("This plan delivers three additions to the Global ERP system:");
  d.bullet("A dedicated /call-center/performance page: 6 KPI cards + enhanced ranked agent table with Answer Rate, Miss Rate, CHSC Conversion %, Revenue per Call, and performance badges.");
  d.bullet("A new AI engine e8 (Call Center Performance Intelligence): integrates into the existing 7-engine Anthropic Claude Sonnet 4.6 layer, generating Diagnostic, Predictive, and Prescriptive signals about agent performance gaps, CHSC conversion imbalances, and coaching opportunities.");
  d.bullet("A new admin settings page (/settings/call-center/performance): every threshold, weight, and KPI target is controlled by the admin without touching code. Values are stored in the existing ai_intelligence_config.thresholds JSONB for engine e8 - no new database table needed.");

  // ── 2. GAP ANALYSIS ──────────────────────────────────────────────────────
  d.section("2. Dashboard Gap Analysis - Current vs. Proposed");
  d.table2(
    ["Metric / Feature", "Current State  =>  Proposed Enhancement"],
    [
      ["Answer Rate %",        "Not shown => Held Calls / Total Calls, colour-coded (>=80% green, >=50% amber, <50% red)"],
      ["Miss Rate %",          "Not shown => 1 - Answer Rate, inverse colour coding"],
      ["Avg Call Duration",    "Not shown => MM:SS format, per-agent column + KPI card"],
      ["CHSC Conversion %",    "Not shown => CHSC Sold / CHSC Car In per agent"],
      ["Revenue per Call",     "Not shown => Collection / Total Calls, normalised for score"],
      ["Trend vs Yesterday",   "No deltas => Delta % badges on all 6 KPI cards"],
      ["Agent Ranking",        "Unordered => Rank column, sorted by composite performance score"],
      ["Performance Badge",    "None => Excellent / Good / Average / Needs Improvement badges"],
      ["AI Insights Panel",    "None => AIPanel with e8 engine (Diagnostic / Predictive / Prescriptive tabs)"],
      ["Empty Agent Rows",     "Huzan, Kripa, Nousheen show blanks => Show zeros, rate fields show -"],
      ["Hardcoded Thresholds", "Badge cutoffs and colour rules in source code => ALL moved to admin settings panel"],
    ]
  );

  // ── 3. KPI CARDS ─────────────────────────────────────────────────────────
  d.section("3. Six KPI Summary Cards (Top of Page)");
  d.table2(
    ["KPI Card", "Formula, Colour Rule & Admin Control"],
    [
      ["Total Calls",        "Count of call_sessions in range. Shows Delta% vs yesterday. No threshold (informational)."],
      ["Answer Rate %",      "(Held Calls / Total Calls) x 100. Colour thresholds: held_rate_green_min (default 80%), held_rate_amber_min (default 50%) - admin controlled."],
      ["Avg Call Duration",  "AVG(duration_seconds) WHERE status=completed AND duration > 0. Formatted MM:SS."],
      ["Total Collection",   "SUM(invoices.grand_total) for agent leads in range. Formatted as currency. Shows Delta% vs yesterday."],
      ["Appointments",       "today_appts + tomorrow_appts from lead_bookings.scheduled_at. Sub-label splits today / tomorrow count."],
      ["CHSC Conversion %",  "SUM(chsc_sold) / SUM(chsc_car_in) x 100. Target line shown from admin threshold target_chsc_loyalty_pct (default 40%)."],
    ]
  );

  // ── 4. AI ENGINE e8 ──────────────────────────────────────────────────────
  d.section("4. New AI Engine - e8: Call Center Performance Intelligence");
  d.para("e8 extends the existing 7-engine layer powered by Anthropic Claude Sonnet 4.6. It analyses per-agent call centre metrics against company benchmarks and prior-period trends, generating up to 5 signals per run:");
  d.bullet("Diagnostic - root causes of held-rate gaps, CHSC conversion shortfalls, appointment misses");
  d.bullet("Predictive - collection trajectory, appointment pipeline, agent performance trend");
  d.bullet("Prescriptive - specific coaching actions with metric targets and deadlines (e.g. 'Increase Fauzul held rate from 71% to 80% within 5 days via morning queue prioritisation')");
  d.y -= 4;
  d.para("Analysis focus areas (driven by admin thresholds):", 0, 9, DARK_GREEN);
  d.bullet("Agents with held rate > alert_held_rate_gap_pp (default 15pp) below company average");
  d.bullet("CHSC vs Non-CHSC conversion imbalances - agents scoring below target_chsc_loyalty_pct");
  d.bullet("Agents with high call volume but zero appointments (opportunity gap)");
  d.bullet("Top performers to recognise and share best practices from");
  d.bullet("Collection-per-call outliers (both above and below average)");
  d.y -= 4;
  d.para("Caching: 5-minute in-memory cache per company/engine/branch (existing signalCache). Config: admin can override prompt, change refresh interval, and set thresholds - all from the existing /settings/ai/intelligence page and the new /settings/call-center/performance page.", 0, 8.5, MED_GRAY);

  // ── 5. IMPLEMENTATION STEPS ──────────────────────────────────────────────
  d.addPage();
  d.section("5. Implementation Steps");

  d.step(1, "New Type Definitions");
  d.filePath("packages/ai-core/src/call-center/types.ts");
  d.para("Add three interfaces at the bottom of the file:");
  d.bullet("CallCenterAgentSummaryRow - all per-agent metrics: totalCalls, heldCalls, heldRatePct, missRatePct, avgDurationSeconds, chscSold, chscCarIn, chscConversionPct, nonChscCarIn, todayAppts, tomorrowAppts, totalCollection, revenuePerCall, performanceScore, performanceBadge");
  d.bullet("CallCenterAgentSummaryFilter - { companyId, from, to }");
  d.bullet("CallCenterAgentSummary - { from, to, agents[], totals{}, yesterday{} }");

  d.step(2, "Repository Method");
  d.filePath("packages/ai-core/src/call-center/repository.ts");
  d.para("Add getAgentSummary(filter) using Promise.all with 4 parallel SQL queries:");
  d.bullet("Q1: Per-agent call metrics from call_sessions (total, held [status=completed AND duration>0], missed, total/avg duration)");
  d.bullet("Q2: Per-agent CRM metrics from leads + lead_bookings + customers + invoices (chsc_sold, chsc_car_in, non_chsc_car_in, today_appts [scheduled_at::date=CURRENT_DATE], tomorrow_appts, total_collection)");
  d.bullet("Q3: Yesterday company-wide call totals for KPI delta cards");
  d.bullet("Q4: Yesterday collection total for delta");
  d.para("Agent identity: COALESCE(l.assigned_user_id, u_emp.id). CHSC filter: UPPER(TRIM(COALESCE(c.customer_type,'')))='CHSC'. Appointment table: lead_bookings (migration 154). Performance score: (heldRatePct x weight_held_rate) + (chscConvPct x weight_chsc_conversion) + (normRevPerCall x weight_revenue_per_call) + (normAppts x weight_appointments) - all weights from admin thresholds.");

  d.step(3, "Service Layer Export");
  d.filePath("packages/ai-core/src/call-center/service.ts");
  d.para("Add getAgentSummary(filter) delegating to repository. Auto-available as CallCenter.getAgentSummary() via existing ai-core index - no index.ts change needed.");

  d.step(4, "New API Route");
  d.filePath("apps/web/app/api/company/[companyId]/call-center/agent-summary/route.ts  [NEW]");
  d.para("GET handler: parse from/to query params (default = today 00:00 to now). Named agent-summary to avoid conflict with existing /call-center/summary endpoint.");

  d.step(5, "e8 Serializer");
  d.filePath("packages/ai-core/src/intelligence/serializers/e8CallCenterSerializer.ts  [NEW]");
  d.para("Follows pattern of e2AgentSerializer.ts. 3 parallel queries: per-agent call metrics, per-agent CRM/CHSC/appointment/collection, previous-window call totals for trend deltas. Returns: window_days, active_agents, company_avg_held_rate_pct, company_avg_collection_per_agent, per-agent breakdown with held_rate_delta_pct.");

  d.step(6, "Register e8 - 3 Files");
  d.filePath("packages/ai-core/src/intelligence/types.ts");
  d.bullet("Add 'e8' to EngineKey union, ENGINE_LABELS (label: 'Call Center Performance Intelligence'), ALL_ENGINE_KEYS array");
  d.filePath("packages/ai-core/src/intelligence/promptLoader.ts");
  d.bullet("Add e8 to ENGINE_ADDITIONS: focus on held rate gaps vs alert_held_rate_gap_pp, CHSC imbalances, zero-appointment agents, top performer recognition");
  d.bullet("Update engine defaults Object.fromEntries and getPrompt fallthrough to include e8");
  d.filePath("packages/ai-core/src/intelligence/orchestratorService.ts");
  d.bullet("Import: import { serialize as e8 } from './serializers/e8CallCenterSerializer'");
  d.bullet("Add e8 to SERIALIZERS record: { e1, e2, e3, e4, e5, e6, e7, e8 }");

  d.step(7, "New Performance Dashboard Page");
  d.filePath("apps/web/app/company/[companyId]/call-center/performance/page.tsx  [NEW]");
  d.para("'use client' component. On mount: fetches agent-summary API + fetches e8 thresholds from /intelligence/config. Layout:");
  d.bullet("Header + date range picker (from/to, defaults to today)");
  d.bullet("AIPanel with engines=['e8'] - Diagnostic/Predictive/Prescriptive tabs");
  d.bullet("6 KPI cards in responsive grid (2 / 3 / 6 cols) - all colour thresholds from admin config");
  d.bullet("Agent table sorted by performanceScore DESC: Rank, Agent, Total Calls, Held, Held%, Miss%, Avg Dur, CHSC Sold, CHSC Car In, CHSC Conv%, Non-CHSC Car In, Today Appt, Tomorrow Appt, Collection, Rev/Call, Badge");
  d.bullet("Zero-call agents show 0 in numeric columns, - in rate columns (no blank rows)");
  d.bullet("All badge cutoffs and colour thresholds read from e8.thresholds with safe defaults");

  // ── 6. ADMIN PANEL ───────────────────────────────────────────────────────
  d.addPage();
  d.section("6. Admin Panel - Performance Thresholds Settings Page");
  d.para("All thresholds are stored in the EXISTING ai_intelligence_config.thresholds JSONB column for engine e8. No new database table or API endpoint is required - the existing /intelligence/config GET and PATCH routes handle everything.", 0, 9, DARK_TEAL);
  d.y -= 4;

  d.step(8, "Admin Settings Page");
  d.filePath("apps/web/app/company/[companyId]/settings/call-center/performance/page.tsx  [NEW]");
  d.para("'use client' settings page following the pattern of /settings/ai/intelligence/page.tsx. Four sections with labeled numeric inputs:");
  d.y -= 2;

  d.sub("Section A - Performance Badge Thresholds");
  d.bullet("Excellent minimum % (default 85) - score >= this => Excellent badge (emerald)");
  d.bullet("Good minimum % (default 70)      - score >= this => Good badge (cyan)");
  d.bullet("Average minimum % (default 50)   - score >= this => Average badge (amber), else Needs Improvement (rose)");

  d.sub("Section B - Held Rate Colour Thresholds");
  d.bullet("Green minimum % (default 80) - Held Rate >= this shows green text");
  d.bullet("Amber minimum % (default 50) - Held Rate >= this shows amber text, below shows red");

  d.sub("Section C - Performance Score Weights");
  d.bullet("Held Rate weight % (default 40)");
  d.bullet("CHSC Conversion weight % (default 25)");
  d.bullet("Revenue per Call weight % (default 20)");
  d.bullet("Appointments weight % (default 15)");
  d.para("Live validation: weights must sum to 100. Red warning shown if they do not. Save button disabled until valid.", 12, 8.5, MED_GRAY);

  d.sub("Section D - KPI Targets");
  d.bullet("CHSC Loyalty Rate target % (default 40) - shown as target line on CHSC Conversion KPI card");
  d.bullet("Appointment Show Rate target % (default 70)");
  d.bullet("Callback Rate target % (default 85)");
  d.bullet("Held Rate alert gap pp (default 15) - AI flags agents this many pp below company average");

  d.y -= 4;
  d.para("Save flow: PATCH /api/company/{id}/intelligence/config with { engine_key: 'e8', thresholds: {...} }. Shows toast on success. Cache is invalidated automatically (existing behaviour).", 0, 9, DARK);
  d.para("The performance dashboard page fetches the same config endpoint on mount and uses the values for all colour thresholds, badge cutoffs, and score weight calculations. Safe defaults (the values above) are used if the admin has not yet saved a config.", 0, 9, DARK);

  // ── 7. THRESHOLD TABLE ───────────────────────────────────────────────────
  d.section("7. Admin-Controlled Threshold Reference");
  d.thresholdTable([
    ["badge_excellent_min",      "Minimum score for Excellent badge",            "85"],
    ["badge_good_min",           "Minimum score for Good badge",                 "70"],
    ["badge_average_min",        "Minimum score for Average badge",              "50"],
    ["held_rate_green_min",      "Held Rate % colour => green",                  "80"],
    ["held_rate_amber_min",      "Held Rate % colour => amber (below = red)",    "50"],
    ["weight_held_rate",         "Performance score weight for held rate (%)",   "40"],
    ["weight_chsc_conversion",   "Performance score weight for CHSC conv (%)",   "25"],
    ["weight_revenue_per_call",  "Performance score weight for revenue/call (%)", "20"],
    ["weight_appointments",      "Performance score weight for appointments (%)", "15"],
    ["target_chsc_loyalty_pct",  "CHSC target % shown on KPI card",              "40"],
    ["target_appointment_show_pct", "Appointment show rate target %",            "70"],
    ["target_callback_rate_pct", "Callback rate target %",                       "85"],
    ["alert_held_rate_gap_pp",   "pp below avg before AI flags agent",           "15"],
  ]);
  d.para("Storage: ai_intelligence_config.thresholds JSONB WHERE engine_key = 'e8'. Served by existing /api/company/[companyId]/intelligence/config. Cache-invalidated on PATCH automatically.", 0, 8.5, MED_GRAY);

  // ── 8. VISUAL DESIGN ─────────────────────────────────────────────────────
  d.section("8. Visual Design - Colour Coding");
  d.table2(
    ["Element", "Colour Rule (threshold key in brackets)"],
    [
      ["Held Rate >= held_rate_green_min",    "text-emerald-400 (green)"],
      ["Held Rate >= held_rate_amber_min",    "text-amber-400 (amber)"],
      ["Held Rate < held_rate_amber_min",     "text-red-400 (red)"],
      ["Miss Rate",                           "Inverse of held rate colour"],
      ["Badge: Excellent (>= badge_excellent_min)", "emerald chip - border-emerald-700/60 bg-emerald-950/40"],
      ["Badge: Good (>= badge_good_min)",          "cyan chip - border-cyan-700/60 bg-cyan-950/40"],
      ["Badge: Average (>= badge_average_min)",    "amber chip - border-amber-700/60 bg-amber-950/40"],
      ["Badge: Needs Improvement (below avg_min)", "rose chip - border-rose-700/60 bg-rose-950/40"],
      ["AI Signal HIGH urgency",              "red border/background on SignalCard"],
      ["AI Signal MED urgency",               "amber/yellow border/background"],
      ["AI Signal LOW urgency",               "green border/background"],
      ["Answer Rate KPI card",                "Same colour thresholds as Held Rate column"],
    ]
  );

  // ── 9. SUGGESTED KPIs ────────────────────────────────────────────────────
  d.section("9. Suggested KPIs for Future Enhancement");
  d.table3(
    ["KPI", "Formula", "Target"],
    [
      ["First Call Resolution %",  "Calls with no follow-up / Total Calls",         ">= 60%"],
      ["Calls per Agent per Hour", "Total Calls / (Total Duration hrs)",             "Company baseline"],
      ["Collection per Call",      "Total Collection / Total Calls",                 "Monitor trend"],
      ["CHSC Loyalty Rate",        "CHSC Sold / CHSC Car In x 100",                 ">= 40% (admin)"],
      ["Appointment Show Rate",    "Car-In count / Prior-day Appointments",          ">= 70% (admin)"],
      ["Agent Efficiency Score",   "Composite: held rate + collection + appts",      "0-100 scale"],
      ["Avg Handling Time (AHT)",  "Total duration / Held Calls",                   "Benchmark by team"],
      ["Lead Conversion Rate",     "Leads closed_won / Total Leads",                ">= 30%"],
      ["Callback Rate",            "Outbound follow-ups / Missed Inbound",          ">= 85% (admin)"],
      ["CHSC Renewal Rate",        "CHSC Sold same customer repeating / Total CHSC", ">= 60%"],
    ],
    170, 195
  );

  // ── 10. CRITICAL FILES ───────────────────────────────────────────────────
  d.addPage();
  d.section("10. Critical Files Reference");
  d.table2(
    ["File", "Action"],
    [
      ["packages/ai-core/src/call-center/types.ts",                                  "Add 3 new interfaces"],
      ["packages/ai-core/src/call-center/repository.ts",                             "Add getAgentSummary with 4 parallel SQL queries"],
      ["packages/ai-core/src/call-center/service.ts",                                "Add getAgentSummary export"],
      ["packages/ai-core/src/intelligence/types.ts",                                 "Add 'e8' to EngineKey, ENGINE_LABELS, ALL_ENGINE_KEYS"],
      ["packages/ai-core/src/intelligence/serializers/e8CallCenterSerializer.ts",    "New file - e8 serializer"],
      ["packages/ai-core/src/intelligence/promptLoader.ts",                          "Add e8 prompt addition + update arrays"],
      ["packages/ai-core/src/intelligence/orchestratorService.ts",                   "Import + register e8 in SERIALIZERS record"],
      ["apps/web/app/api/company/[companyId]/call-center/agent-summary/route.ts",    "New API route (GET with from/to params)"],
      ["apps/web/app/company/[companyId]/call-center/performance/page.tsx",          "New dashboard page - reads e8 thresholds from config on mount"],
      ["apps/web/app/company/[companyId]/settings/call-center/performance/page.tsx", "NEW admin settings page - controls all thresholds"],
      ["packages/ui/src/layout/sidebarConfig.ts",                                    "Add 2 nav entries: dashboard + settings"],
    ]
  );

  d.y -= 6;
  d.para("Key reuse patterns:", 0, 9, DARK_GREEN);
  d.bullet("Config fetch + PATCH: apps/web/app/company/[companyId]/settings/ai/intelligence/page.tsx");
  d.bullet("AIPanel + SignalCard: apps/web/app/(components)/intelligence/");
  d.bullet("Agent badge pattern: apps/web/app/company/[companyId]/data-center/page.tsx lines 603-629");
  d.bullet("Serializer structure: packages/ai-core/src/intelligence/serializers/e2AgentSerializer.ts");
  d.bullet("CHSC segment filter: packages/ai-core/src/customer-data-center/repository.ts lines 24-32");
  d.bullet("Appointment data: lead_bookings.scheduled_at - migration 154_lead_bookings_and_workshop_visit_mode.sql");
  d.bullet("Intelligence config API: apps/web/app/api/company/[companyId]/intelligence/config/route.ts");

  // ── 11. VERIFICATION ─────────────────────────────────────────────────────
  d.section("11. Verification Steps");
  d.bullet("tsc --noEmit in project root - must compile clean before testing");
  d.bullet("Navigate to /settings/call-center/performance - verify all 13 threshold inputs load with default values");
  d.bullet("Change a threshold (e.g. badge_excellent_min from 85 to 90), save - verify PATCH persists and page reloads correct values");
  d.bullet("GET /api/company/{id}/call-center/agent-summary - verify JSON shape matches CallCenterAgentSummary (agents[], totals{}, yesterday{})");
  d.bullet("GET /api/company/{id}/intelligence/signals?engines=e8 - verify response has engines array with 1-5 signals, urgency field present");
  d.bullet("Navigate to /company/{id}/call-center/performance - verify: 6 KPI cards show data, delta badges visible, agent table ranked with badges, AIPanel renders 3 tabs");
  d.bullet("Change badge_excellent_min to 99 in admin - verify all agents drop to lower badge on dashboard refresh");
  d.bullet("Test future date range (no data) - verify all agents show 0 calls and - for rate fields (no blank rows)");
  d.bullet("Confirm sidebar shows 'Performance Summary' under Call Center and 'Performance Thresholds' under Settings");

  // ── FOOTERS ──────────────────────────────────────────────────────────────
  d.addFooters();

  const outPath = resolve("c:/Users/ABC/Desktop/CallCenter_AI_Enhancement_Plan_v2.pdf");
  writeFileSync(outPath, await pdfDoc.save());
  console.log("PDF saved to:", outPath);
}

generate().catch((e) => { console.error(e); process.exit(1); });
