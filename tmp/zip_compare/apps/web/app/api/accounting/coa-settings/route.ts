import { NextResponse, NextRequest } from "next/server";
import { getSql } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(request: Request) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
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
    const hasCustomCoa = Boolean(colCheck?.exists);
    const [row] = hasCustomCoa
      ? await sql<{ allow_custom_coa: boolean }[]>`
          SELECT allow_custom_coa
          FROM companies
          WHERE id = ${companyId}
          LIMIT 1
        `
      : [undefined];

    return NextResponse.json({ data: { allowCustomCoa: hasCustomCoa ? row?.allow_custom_coa ?? false : false } });
  } catch (error) {
    console.error("GET /api/accounting/coa-settings error", error);
    return NextResponse.json({ data: { allowCustomCoa: false } });
  }
}
