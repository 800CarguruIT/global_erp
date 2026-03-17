import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "../../../../lib/auth/current-user";
import { getUserContext } from "../../../../lib/auth/user-context";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getUserContext(userId);
  return NextResponse.json(ctx);
}
