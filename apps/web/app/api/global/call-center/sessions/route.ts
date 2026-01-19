import { NextRequest, NextResponse } from "next/server";
import { CallCenter } from "@repo/ai-core";

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  return req.headers.get("x-user-id");
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
  const createdByMeOnly = url.searchParams.get("createdByMeOnly") === "true";

  try {
    const sessions = await CallCenter.listRecentCalls({
      scope: "global",
      companyId: null,
      branchId: null,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      createdByUserId: createdByMeOnly ? userId : undefined,
    });
    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error("GET /api/global/call-center/sessions error:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
