import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Ctx = { params: Promise<{ companyId: string; vendorId: string; quoteId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { companyId, vendorId, quoteId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const partNumber = String(body.partNumber ?? "").trim();
  const diagramFileId = String(body.diagramFileId ?? "").trim();

  if (!partNumber) {
    return NextResponse.json({ error: "Part number is required." }, { status: 400 });
  }
  if (!diagramFileId) {
    return NextResponse.json({ error: "Part diagram is required." }, { status: 400 });
  }

  const sql = getSql();

  // Verify quote belongs to this vendor/company
  const [quote] = await sql<{ id: string }[]>`
    SELECT id FROM part_quotes
    WHERE id = ${quoteId} AND company_id = ${companyId} AND vendor_id = ${vendorId}
  `;
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  await sql`
    UPDATE part_quotes
    SET vendor_part_number = ${partNumber},
        diagram_file_id = ${diagramFileId},
        updated_at = now()
    WHERE id = ${quoteId}
  `;

  return NextResponse.json({ success: true, quoteId, partNumber, diagramFileId });
}
