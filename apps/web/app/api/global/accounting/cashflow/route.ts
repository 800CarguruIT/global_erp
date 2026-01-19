import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core/server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const dateTo = url.searchParams.get("to") ?? dateFrom;
    const rows = await Accounting.getGlobalCashFlow({ dateFrom, dateTo });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/global/accounting/cashflow error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
