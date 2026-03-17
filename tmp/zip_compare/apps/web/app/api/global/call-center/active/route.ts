import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

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
        created_at: string | null;
      }[]
    >`
      SELECT
        id,
        provider_call_id,
        from_number,
        to_number,
        direction,
        status,
        started_at::text,
        created_at::text
      FROM call_sessions
      WHERE
        (
          (status = 'ringing' AND created_at > NOW() - INTERVAL '3 minutes')
          OR (
            status = 'in_progress'
            AND COALESCE(started_at, created_at) > NOW() - INTERVAL '4 hours'
          )
        )
      ORDER BY COALESCE(started_at, created_at) DESC NULLS LAST
      LIMIT ${Number.isFinite(limit) && limit > 0 ? limit : 20}
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/global/call-center/active error", error);
    return NextResponse.json({ error: "Failed to load active calls" }, { status: 500 });
  }
}
