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
            heading_id: string;
            name: string;
            subhead_code: string;
            company_id: string | null;
            is_active: boolean;
            head_code: string;
          }>
        >`
          WITH effective_headings AS (
            SELECT DISTINCT ON (head_code) id, head_code
            FROM accounting_headings
            WHERE (company_id IS NULL OR company_id = ${companyId})
              AND is_active = TRUE
            ORDER BY head_code, (company_id IS NULL)
          )
          SELECT DISTINCT ON (h.head_code, s.subhead_code)
            s.id, s.heading_id, s.name, s.subhead_code, s.company_id, s.is_active, h.head_code
          FROM accounting_subheadings s
          JOIN accounting_headings h ON h.id = s.heading_id
          JOIN effective_headings eh ON eh.head_code = h.head_code AND eh.id = h.id
          WHERE (s.company_id IS NULL OR s.company_id = ${companyId})
            AND s.is_active = TRUE
          ORDER BY h.head_code, s.subhead_code, (s.company_id IS NULL)
        `
      : await sql<
          Array<{
            id: string;
            heading_id: string;
            name: string;
            subhead_code: string;
          }>
        >`
          SELECT id, heading_id, name, subhead_code
          FROM accounting_subheadings
          WHERE is_active = TRUE
          ORDER BY subhead_code
        `;

    const data =
      rows?.map((row) => ({
        id: row.id,
        headingId: row.heading_id,
        name: row.name,
        subheadCode: row.subhead_code,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/accounting/subheadings error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { companyId, headingId, name, subheadCode } = body ?? {};
    if (!companyId || !headingId || !name || !subheadCode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sql = getSql();
    const [companyRow] = await sql<{ allow_custom_coa: boolean }[]>`
      SELECT allow_custom_coa FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    if (!companyRow?.allow_custom_coa) {
      return NextResponse.json({ error: "Custom subheadings disabled for this company" }, { status: 403 });
    }

    const [headingRow] = await sql<{ id: string; company_id: string | null }[]>`
      SELECT id, company_id
      FROM accounting_headings
      WHERE id = ${headingId}
      LIMIT 1
    `;
    if (!headingRow || (headingRow.company_id && headingRow.company_id !== companyId)) {
      return NextResponse.json({ error: "Heading not found" }, { status: 404 });
    }

    const rows = await sql<
      Array<{
        id: string;
        name: string;
        subhead_code: string;
        heading_id: string;
      }>
    >`
      INSERT INTO accounting_subheadings (heading_id, name, subhead_code, company_id, is_active)
      VALUES (${headingId}, ${name}, ${subheadCode}, ${companyId}, TRUE)
      RETURNING id, name, subhead_code, heading_id
    `;

    const row = rows?.[0];
    if (!row) return NextResponse.json({ error: "Failed to create subheading" }, { status: 500 });

    return NextResponse.json({
      data: {
        id: row.id,
        headingId: row.heading_id,
        name: row.name,
        subheadCode: row.subhead_code,
      },
    });
  } catch (error) {
    console.error("POST /api/accounting/subheadings error", error);
    return NextResponse.json({ error: "Failed to create subheading" }, { status: 500 });
  }
}
