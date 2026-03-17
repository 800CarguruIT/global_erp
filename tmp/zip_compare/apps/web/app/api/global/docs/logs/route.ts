import { NextRequest, NextResponse } from "next/server";

import { readActionLogs } from "../../../../../lib/docs-admin";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 100;
  const data = await readActionLogs(limit);
  return NextResponse.json({ data });
}
