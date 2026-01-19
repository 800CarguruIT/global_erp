import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; jobCardId: string; lineItemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, jobCardId, lineItemId } = await params;
  const body = await req.json().catch(() => ({}));
  const partPic = body?.partPic ?? undefined;
  const scrapPic = body?.scrapPic ?? undefined;

  if (partPic === undefined && scrapPic === undefined) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE line_items
    SET
      part_pic = COALESCE(${partPic ?? null}, part_pic),
      scrap_pic = COALESCE(${scrapPic ?? null}, scrap_pic)
    WHERE id = ${lineItemId}
      AND job_card_id = ${jobCardId}
      AND company_id = ${companyId}
    RETURNING id, part_pic, scrap_pic
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: rows[0] });
}
