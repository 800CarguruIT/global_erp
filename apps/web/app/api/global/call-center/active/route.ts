import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
    const rows = await sql<
      {
        id: string;
        provider_call_id: string | null;
        from_number: string | null;
        to_number: string | null;
        direction: string | null;
        status: string | null;
        started_at: string | null;
      }[]
    >`
      SELECT
        id,
        provider_call_id,
        from_number,
        to_number,
        direction,
        status,
        started_at
      FROM call_sessions
      WHERE status IN ('ringing','in_progress')
      ORDER BY started_at DESC NULLS LAST
      LIMIT ${Number.isFinite(limit) && limit > 0 ? limit : 20}
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/global/call-center/active error", error);
    return NextResponse.json({ error: "Failed to load active calls" }, { status: 500 });
  }
}
