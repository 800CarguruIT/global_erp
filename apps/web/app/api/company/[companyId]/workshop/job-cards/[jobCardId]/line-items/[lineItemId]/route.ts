import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { getUserContext } from "@/lib/auth/user-context";

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
  const currentUserId = await getCurrentUserIdFromRequest(req);
  if (!currentUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserContext = await getUserContext(currentUserId);
  if (currentUserContext.scope === "branch") {
    const currentUserBranchId = currentUserContext.companies[0]?.branchId ?? null;
    const jobCardRows = await sql`
      SELECT l.branch_id AS lead_branch_id
      FROM job_cards jc
      LEFT JOIN estimates e ON e.id = jc.estimate_id
      LEFT JOIN leads l ON l.id = e.lead_id
      WHERE jc.id = ${jobCardId} AND e.company_id = ${companyId}
      LIMIT 1
    `;
    if (!jobCardRows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const assignedBranchId = jobCardRows[0]?.lead_branch_id ?? null;
    if (!currentUserBranchId || !assignedBranchId || currentUserBranchId !== assignedBranchId) {
      return NextResponse.json(
        { error: "Only assigned workshop can perform this action." },
        { status: 403 }
      );
    }
  }
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
