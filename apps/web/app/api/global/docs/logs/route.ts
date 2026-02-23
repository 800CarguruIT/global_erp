import { NextRequest, NextResponse } from "next/server";

import { readActionLogs } from "../../../../../lib/docs-admin";

export async function GET(request: NextRequest) {
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 100;
  const data = await readActionLogs(limit);
  return NextResponse.json({ data });
}
