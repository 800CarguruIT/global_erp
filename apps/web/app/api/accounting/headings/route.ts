import { NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export async function GET(request: Request) {
  try {
    const sql = getSql();
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");

    const rows = companyId
      ? await sql<
          Array<{
            id: string;
            name: string;
            head_code: string;
            financial_stmt: string;
            company_id: string | null;
            is_active: boolean;
          }>
        >`
          SELECT DISTINCT ON (head_code)
            id, name, head_code, financial_stmt, company_id, is_active
          FROM accounting_headings
          WHERE (company_id IS NULL OR company_id = ${companyId})
            AND is_active = TRUE
          ORDER BY head_code, (company_id IS NULL)
        `
      : await sql<
          Array<{
            id: string;
            name: string;
            head_code: string;
            financial_stmt: string;
            company_id: string | null;
            is_active: boolean;
          }>
        >`
          SELECT id, name, head_code, financial_stmt, company_id, is_active
          FROM accounting_headings
          WHERE is_active = TRUE
          ORDER BY head_code
        `;

    const data =
      rows?.map((row) => ({
        id: row.id,
        name: row.name,
        headCode: row.head_code,
        financialStmt: row.financial_stmt,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/accounting/headings error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { companyId, name, headCode, financialStmt } = body ?? {};
    if (!companyId || !name || !headCode || !financialStmt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sql = getSql();
    const [companyRow] = await sql<{ allow_custom_coa: boolean }[]>`
      SELECT allow_custom_coa FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    if (!companyRow?.allow_custom_coa) {
      return NextResponse.json({ error: "Custom headings disabled for this company" }, { status: 403 });
    }

    const rows = await sql<
      Array<{
        id: string;
        name: string;
        head_code: string;
        financial_stmt: string;
      }>
    >`
      INSERT INTO accounting_headings (name, head_code, financial_stmt, company_id, is_active)
      VALUES (${name}, ${headCode}, ${financialStmt}, ${companyId}, TRUE)
      RETURNING id, name, head_code, financial_stmt
    `;

    const row = rows?.[0];
    if (!row) return NextResponse.json({ error: "Failed to create heading" }, { status: 500 });

    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        headCode: row.head_code,
        financialStmt: row.financial_stmt,
      },
    });
  } catch (error) {
    console.error("POST /api/accounting/headings error", error);
    return NextResponse.json({ error: "Failed to create heading" }, { status: 500 });
  }
}
