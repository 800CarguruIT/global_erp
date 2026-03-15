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
  const receiveStatusRaw = body?.receiveStatus ?? undefined;

  if (partPic === undefined && scrapPic === undefined && receiveStatusRaw === undefined) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const normalizedReceiveStatus =
    receiveStatusRaw === undefined
      ? null
      : String(receiveStatusRaw)
          .trim()
          .toLowerCase();
  const receiveStatusMap = new Map<string, "Ordered" | "Received" | "Returned" | "Partially Received">([
    ["ordered", "Ordered"],
    ["received", "Received"],
    ["return", "Returned"],
    ["returned", "Returned"],
    ["partially received", "Partially Received"],
    ["partially_received", "Partially Received"],
    ["partial", "Partially Received"],
  ]);
  const normalizedReceiveStatusLabel =
    normalizedReceiveStatus === null ? null : receiveStatusMap.get(normalizedReceiveStatus) ?? null;
  if (receiveStatusRaw !== undefined && !normalizedReceiveStatusLabel) {
    return NextResponse.json({ error: "Invalid receive status" }, { status: 400 });
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
      scrap_pic = COALESCE(${scrapPic ?? null}, scrap_pic),
      order_status = COALESCE(
        ${
          normalizedReceiveStatusLabel === "Received"
            ? "Received"
            : normalizedReceiveStatusLabel === "Returned"
            ? "Returned"
            : normalizedReceiveStatusLabel === "Partially Received"
            ? "Ordered"
            : normalizedReceiveStatusLabel === "Ordered"
            ? "Ordered"
            : null
        },
        order_status
      )
    WHERE id = ${lineItemId}
      AND job_card_id = ${jobCardId}
      AND company_id = ${companyId}
    RETURNING id, part_pic, scrap_pic, order_status
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (normalizedReceiveStatusLabel) {
    const partQuoteStatus =
      normalizedReceiveStatusLabel === "Returned"
        ? "Return"
        : normalizedReceiveStatusLabel === "Partially Received"
        ? "Partially Received"
        : normalizedReceiveStatusLabel;
    const deliveryNoteStatus =
      normalizedReceiveStatusLabel === "Received"
        ? "delivery_received"
        : normalizedReceiveStatusLabel === "Returned"
        ? "delivery_returned"
        : normalizedReceiveStatusLabel === "Partially Received"
        ? "delivery_partially_received"
        : "issued";
    await sql`
      UPDATE part_quotes
      SET
        status = ${partQuoteStatus},
        delivery_note_status = ${deliveryNoteStatus},
        updated_at = NOW()
      WHERE company_id = ${companyId}
        AND line_item_id = ${lineItemId}
    `;
  }

  return NextResponse.json({
    data: {
      ...rows[0],
      receive_status: normalizedReceiveStatusLabel ?? rows[0]?.order_status ?? null,
    },
  });
}
