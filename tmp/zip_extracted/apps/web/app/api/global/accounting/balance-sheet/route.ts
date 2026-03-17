import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core/server";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const url = new URL(req.url);
    const dateAsOf = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const rows = await Accounting.getGlobalBalanceSheet({ dateAsOf });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/global/accounting/balance-sheet error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
