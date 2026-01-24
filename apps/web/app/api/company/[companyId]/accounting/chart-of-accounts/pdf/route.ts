import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getSql } from "@repo/ai-core";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCoaHtml(payload: {
  companyName: string;
  rows: Array<{
    head_code: string;
    heading_name: string;
    financial_stmt: string;
    subhead_code: string;
    subheading_name: string;
    group_code: string;
    group_name: string;
    account_code: string | null;
    account_name: string | null;
  }>;
}) {
  type Row = (typeof payload.rows)[number];
  const byHeading = new Map<string, Row[]>();
  for (const row of payload.rows) {
    const key = row.head_code;
    if (!byHeading.has(key)) byHeading.set(key, []);
    byHeading.get(key)!.push(row);
  }

  const buildHeadingSection = (headingCode: string, title: string) => {
    const rows = byHeading.get(headingCode) ?? [];
    if (!rows.length) return "";

    const bySub = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row.subhead_code;
      if (!bySub.has(key)) bySub.set(key, []);
      bySub.get(key)!.push(row);
    }

    const subSections = Array.from(bySub.values())
      .sort((a, b) => a[0].subhead_code.localeCompare(b[0].subhead_code))
      .map((subRows) => {
        const sub = subRows[0];
        const byGroup = new Map<string, Row[]>();
        for (const row of subRows) {
          const key = row.group_code;
          if (!byGroup.has(key)) byGroup.set(key, []);
          byGroup.get(key)!.push(row);
        }

        const groupRows = Array.from(byGroup.values())
          .sort((a, b) => a[0].group_code.localeCompare(b[0].group_code))
          .map((groupRows) => {
            const group = groupRows[0];
            const accounts = groupRows
              .filter((r) => r.account_code && r.account_name)
              .map(
                (a) => `
                  <tr>
                    <td class="code">${escapeHtml(a.account_code ?? "-")}</td>
                    <td>${escapeHtml(a.account_name ?? "-")}</td>
                  </tr>
                `
              )
              .join("");

            return `
              <div class="group-block">
                <div class="group-label">${escapeHtml(group.group_code)} ${escapeHtml(group.group_name)}</div>
                <table class="coa-table">
                  <tbody>
                    ${accounts || `<tr><td class="code">-</td><td>No accounts</td></tr>`}
                  </tbody>
                </table>
              </div>
            `;
          })
          .join("");

        return `
          <div class="subheading-block">
            <div class="subheading-title">${escapeHtml(sub.subhead_code)} ${escapeHtml(sub.subheading_name)}</div>
            ${groupRows}
          </div>
        `;
      })
      .join("");

    return `
      <div class="panel">
        <div class="panel-title">${escapeHtml(title)} (${escapeHtml(headingCode)}00)</div>
        ${subSections}
      </div>
    `;
  };

  const balanceLeft = buildHeadingSection("1", "Assets");
  const balanceRight = [buildHeadingSection("2", "Liabilities"), buildHeadingSection("3", "Equity")].join("");
  const plLeft = buildHeadingSection("4", "Income");
  const plRight = buildHeadingSection("5", "Expenses");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Chart of Accounts</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0d1220; }
        h1 { margin: 0; font-size: 14px; letter-spacing: 0.4px; }
        .header-bar { background: #1f3a6f; color: #fff; padding: 6px 10px; text-align: center; font-weight: 700; }
        .subtitle { font-size: 10px; color: #e6eefc; text-align: center; margin-top: 2px; }
        .page-title { background: #1f3a6f; color: #fff; text-align: center; font-weight: 700; padding: 4px 6px; font-size: 10px; }
        .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .panel { border: 1px solid #1f3a6f; margin-bottom: 10px; }
        .panel-title { background: #1f3a6f; color: #fff; font-size: 10px; padding: 4px 6px; font-weight: 700; }
        .subheading-title { font-weight: 700; font-size: 10px; padding: 4px 6px; border-bottom: 1px solid #d2d9e6; }
        .group-block { padding: 2px 6px 6px; }
        .group-label { font-size: 10px; font-weight: 600; margin: 2px 0; }
        .coa-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .coa-table td { padding: 2px 4px; border-bottom: 1px solid #e3e7ef; }
        .coa-table tr:last-child td { border-bottom: none; }
        .code { width: 70px; font-weight: 600; }
        .section-space { margin-top: 10px; }
        .page-break { page-break-before: always; }
      </style>
    </head>
    <body>
      <div class="header-bar">
        <h1>Chart of Accounts</h1>
        <div class="subtitle">${escapeHtml(payload.companyName)}</div>
      </div>

      <div class="section-space">
        <div class="page-title">BALANCE SHEET ACCOUNTS</div>
      </div>
      <div>
        ${balanceLeft || "<div>No assets</div>"}
        ${balanceRight || "<div>No liabilities or equity</div>"}
      </div>

      <div class="page-break"></div>
      <div class="section-space">
        <div class="page-title">PROFIT &amp; LOSS ACCOUNTS</div>
      </div>
      <div>
        ${plLeft || "<div>No income</div>"}
        ${plRight || "<div>No expenses</div>"}
      </div>
    </body>
  </html>`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const resolved = await params;
  const companyId = resolved.companyId;
  const sql = getSql();

  const [company] = await sql<{ display_name: string | null; legal_name: string | null }[]>`
    SELECT display_name, legal_name
    FROM companies
    WHERE id = ${companyId}
    LIMIT 1
  `;
  const rows = await sql<
    Array<{
      head_code: string;
      heading_name: string;
      financial_stmt: string;
      subhead_code: string;
      subheading_name: string;
      group_code: string;
      group_name: string;
      account_code: string | null;
      account_name: string | null;
    }>
  >`
    SELECT
      h.head_code,
      h.name AS heading_name,
      h.financial_stmt,
      s.subhead_code,
      s.name AS subheading_name,
      g.group_code,
      g.name AS group_name,
      a.account_code,
      a.account_name
    FROM accounting_groups g
    JOIN accounting_subheadings s ON s.id = g.subheading_id
    JOIN accounting_headings h ON h.id = g.heading_id
    LEFT JOIN accounting_accounts a
      ON a.group_id = g.id AND a.company_id = ${companyId}
    WHERE g.company_id = ${companyId}
    ORDER BY h.head_code, s.subhead_code, g.group_code, a.account_code NULLS LAST
  `;

  const companyName = company?.display_name || company?.legal_name || "Company";
  const html = buildCoaHtml({ companyName, rows });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await page.close();
  await browser.close();

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="chart-of-accounts-${companyId}.pdf"`,
    },
  });
}
