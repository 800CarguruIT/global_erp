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
            subheading_id: string;
            company_id: string | null;
            name: string;
            group_code: string;
          }>
        >`
          SELECT id, heading_id, subheading_id, company_id, name, group_code
          FROM accounting_groups
          WHERE company_id = ${companyId}
          ORDER BY group_code
        `
      : await sql<
          Array<{
            id: string;
            heading_id: string;
            subheading_id: string;
            company_id: string | null;
            name: string;
            group_code: string;
          }>
        >`
          SELECT id, heading_id, subheading_id, company_id, name, group_code
          FROM accounting_groups
          ORDER BY group_code
        `;

    const data =
      rows?.map((row) => ({
        id: row.id,
        headingId: row.heading_id,
        subheadingId: row.subheading_id,
        companyId: row.company_id,
        name: row.name,
        groupCode: row.group_code,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/accounting/groups error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const sql = getSql();
    const body = await request.json();
    const {
      headingId,
      subheadingId,
      companyId,
      name,
      groupCode,
    }: {
      headingId?: string;
      subheadingId?: string;
      companyId?: string | null;
      name?: string;
      groupCode?: string;
    } = body ?? {};

    if (!headingId || !subheadingId || !name || !groupCode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rows = await sql<
      Array<{
        id: string;
        heading_id: string;
        subheading_id: string;
        company_id: string | null;
        name: string;
        group_code: string;
      }>
    >`
      INSERT INTO accounting_groups (heading_id, subheading_id, company_id, name, group_code)
      VALUES (${headingId}, ${subheadingId}, ${companyId ?? null}, ${name}, ${groupCode})
      RETURNING id, heading_id, subheading_id, company_id, name, group_code
    `;

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        headingId: row.heading_id,
        subheadingId: row.subheading_id,
        companyId: row.company_id,
        name: row.name,
        groupCode: row.group_code,
      },
    });
  } catch (error) {
    console.error("POST /api/accounting/groups error", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const companyId = url.searchParams.get("companyId");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const sql = getSql();
    if (companyId) {
      await sql`DELETE FROM accounting_groups WHERE id = ${id} AND company_id = ${companyId}`;
    } else {
      await sql`DELETE FROM accounting_groups WHERE id = ${id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/accounting/groups error", error);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
