import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { CustomerDataCenter } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type Segment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";
type ExportFormat = "csv" | "excel" | "pdf";

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSegment(value: string | null | undefined): Segment | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "chsc") return "chsc";
  if (v === "non_chsc" || v === "non-chsc") return "non_chsc";
  if (v === "insurance") return "insurance";
  if (v === "warranty" || v === "battery-warranty") return "warranty";
  if (v === "unknown") return "unknown";
  return undefined;
}

function normalizeFormat(value: string | null): ExportFormat {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "pdf") return "pdf";
  if (v === "excel" || v === "xls" || v === "xlsx") return "excel";
  return "csv";
}

function csvEscape(value: string | number | null): string {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

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

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

type AgentRow = {
  agentUserId: string;
  agentName: string | null;
  assignedCustomers: number;
  contactedCustomers: number;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number | null;
};

function buildExcelHtml(rows: AgentRow[], companyId: string, from: Date, to: Date, segment?: Segment) {
  const bodyRows = rows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(sanitizeCell(row.agentUserId || "-"))}</td>
          <td>${escapeHtml(sanitizeCell(row.agentName || "-"))}</td>
          <td>${escapeHtml(String(row.assignedCustomers))}</td>
          <td>${escapeHtml(String(row.contactedCustomers))}</td>
          <td>${escapeHtml(String(row.totalCalls))}</td>
          <td>${escapeHtml(String(row.answeredCalls))}</td>
          <td>${escapeHtml(String(row.failedCalls))}</td>
          <td>${escapeHtml(String(row.totalDurationSeconds))}</td>
          <td>${escapeHtml(String(row.avgDurationSeconds ?? "-"))}</td>
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
      <h1>Data Center Agents Export</h1>
      <p class="meta">Company: ${escapeHtml(companyId)} | From: ${escapeHtml(
        from.toISOString().slice(0, 10)
      )} | To: ${escapeHtml(to.toISOString().slice(0, 10))} | Segment: ${escapeHtml(
        segment ?? "all"
      )} | Date: ${escapeHtml(fileStamp())}</p>
      <table>
        <thead>
          <tr>
            <th>Agent User ID</th>
            <th>Agent Name</th>
            <th>Assigned Customers</th>
            <th>Contacted Customers</th>
            <th>Total Calls</th>
            <th>Answered Calls</th>
            <th>Failed Calls</th>
            <th>Total Duration Seconds</th>
            <th>Avg Duration Seconds</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </body>
  </html>`;
}

async function buildPdf(rows: AgentRow[], companyId: string, from: Date, to: Date, segment?: Segment) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595]; // A4 landscape
  const margin = 24;
  const rowHeight = 16;
  const cols = [24, 112, 134, 70, 70, 62, 62, 60, 90, 90];
  const headers = [
    "#",
    "Agent User ID",
    "Agent Name",
    "Assigned",
    "Contacted",
    "Calls",
    "Answered",
    "Failed",
    "Total Dur(s)",
    "Avg Dur(s)",
  ];

  const drawHeader = (page: PDFPage) => {
    const { height } = page.getSize();
    page.drawText("Data Center Agents Export", {
      x: margin,
      y: height - 20,
      size: 13,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    page.drawText(
      toPdfSafeText(
        `Company: ${companyId} | From: ${from.toISOString().slice(0, 10)} | To: ${to
          .toISOString()
          .slice(0, 10)} | Segment: ${segment ?? "all"} | Date: ${fileStamp()}`,
        220
      ),
      { x: margin, y: height - 34, size: 8, font, color: rgb(0.3, 0.3, 0.3) }
    );
    let x = margin;
    const y = height - 56;
    headers.forEach((h, idx) => {
      page.drawText(h, { x: x + 2, y, size: 8.2, font: fontBold, color: rgb(0.08, 0.12, 0.2) });
      x += cols[idx];
    });
    page.drawLine({
      start: { x: margin, y: y - 3 },
      end: { x: pageSize[0] - margin, y: y - 3 },
      thickness: 0.6,
      color: rgb(0.7, 0.72, 0.76),
    });
  };

  let page = pdf.addPage(pageSize);
  drawHeader(page);
  let y = page.getSize().height - 74;

  rows.forEach((row, idx) => {
    if (y < margin + 10) {
      page = pdf.addPage(pageSize);
      drawHeader(page);
      y = page.getSize().height - 74;
    }
    const values = [
      String(idx + 1),
      toPdfSafeText(row.agentUserId, 18),
      toPdfSafeText(row.agentName, 22),
      String(row.assignedCustomers),
      String(row.contactedCustomers),
      String(row.totalCalls),
      String(row.answeredCalls),
      String(row.failedCalls),
      String(row.totalDurationSeconds),
      String(row.avgDurationSeconds ?? "-"),
    ];
    let x = margin;
    values.forEach((v, colIdx) => {
      page.drawText(v, { x: x + 2, y, size: 8, font, color: rgb(0.1, 0.12, 0.15) });
      x += cols[colIdx];
    });
    page.drawLine({
      start: { x: margin, y: y - 2 },
      end: { x: pageSize[0] - margin, y: y - 2 },
      thickness: 0.35,
      color: rgb(0.84, 0.86, 0.89),
    });
    y -= rowHeight;
  });

  return Buffer.from(await pdf.save());
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  let access: Awaited<ReturnType<typeof resolveDataCenterAccess>>;
  try {
    access = await resolveDataCenterAccess(userId, companyId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const to = parseDate(url.searchParams.get("to")) ?? new Date();
  const from = parseDate(url.searchParams.get("from")) ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const segment = normalizeSegment(url.searchParams.get("segment"));
  const format = normalizeFormat(url.searchParams.get("format"));
  const supervisorUserIdRaw = url.searchParams.get("supervisorUserId");
  const agentUserIdRaw = url.searchParams.get("agentUserId");

  let supervisorUserId = supervisorUserIdRaw || undefined;
  let agentUserId = agentUserIdRaw || undefined;
  if (access.scope === "supervisor") {
    supervisorUserId = access.supervisorUserId;
  } else if (access.scope === "agent") {
    supervisorUserId = undefined;
    agentUserId = access.agentUserId;
  }

  try {
    const report = await CustomerDataCenter.getAgentsReport({
      companyId,
      from,
      to,
      segment,
      supervisorUserId,
      agentUserId,
    });

    const rows = report.rows;

    if (format === "pdf") {
      const file = await buildPdf(rows, companyId, from, to, segment);
      return new NextResponse(file, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="data-center-agents-${from
            .toISOString()
            .slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.pdf"`,
        },
      });
    }

    if (format === "excel") {
      const html = buildExcelHtml(rows, companyId, from, to, segment);
      return new NextResponse(`\uFEFF${html}`, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="data-center-agents-${from
            .toISOString()
            .slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.xls"`,
        },
      });
    }

    const header = [
      "agent_user_id",
      "agent_name",
      "assigned_customers",
      "contacted_customers",
      "total_calls",
      "answered_calls",
      "failed_calls",
      "total_duration_seconds",
      "avg_duration_seconds",
    ];
    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.agentUserId),
          csvEscape(row.agentName),
          csvEscape(row.assignedCustomers),
          csvEscape(row.contactedCustomers),
          csvEscape(row.totalCalls),
          csvEscape(row.answeredCalls),
          csvEscape(row.failedCalls),
          csvEscape(row.totalDurationSeconds),
          csvEscape(row.avgDurationSeconds),
        ].join(",")
      );
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="data-center-agents-${from.toISOString().slice(0, 10)}-to-${to
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("from must be before to")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("GET /api/company/[companyId]/data-center/reports/export error:", error);
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}
