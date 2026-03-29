import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/server";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const sql = getSql();

  const agentUserId = url.searchParams.get("agentUserId");
  if (!agentUserId) {
    return NextResponse.json({ error: "agentUserId is required" }, { status: 400 });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0") || 0;

  // Get agent's extension (mobile) for matching to_number
  const userRow = await sql<{ mobile: string | null }[]>`
    SELECT mobile FROM users WHERE id = ${agentUserId} LIMIT 1
  `;
  const ext = userRow[0]?.mobile ?? null;

  const rows = await sql<{
    id: string;
    direction: string;
    from_number: string;
    to_number: string;
    status: string;
    duration_seconds: number | null;
    created_at: string;
    customer_name: string | null;
    customer_phone: string | null;
  }[]>`
    SELECT
      cs.id,
      cs.direction,
      cs.from_number,
      cs.to_number,
      cs.status,
      cs.duration_seconds,
      cs.created_at,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM call_sessions cs
    LEFT JOIN customers c ON c.id = cs.to_entity_id AND c.company_id = ${companyId}
    WHERE cs.company_id = ${companyId}
      AND (
        cs.created_by_user_id = ${agentUserId}
        ${ext ? sql`OR cs.to_number = ${ext}` : sql``}
      )
    ORDER BY cs.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return NextResponse.json({ calls: rows });
}
