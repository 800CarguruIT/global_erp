import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, enabled } = body ?? {};
    if (!companyId || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const sql = getSql();
    const [colCheck] = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'companies'
          AND column_name = 'allow_custom_coa'
      ) AS exists
    `;
    if (!colCheck?.exists) {
      return NextResponse.json({ error: "COA settings not available (migration missing)" }, { status: 400 });
    }
    const [row] = await sql<{ id: string; allow_custom_coa: boolean }[]>`
      UPDATE companies
      SET allow_custom_coa = ${enabled}
      WHERE id = ${companyId}
      RETURNING id, allow_custom_coa
    `;
    if (!row) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    return NextResponse.json({ data: row });
  } catch (error) {
    console.error("PATCH /api/global/accounting/coa-company-settings error", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}
