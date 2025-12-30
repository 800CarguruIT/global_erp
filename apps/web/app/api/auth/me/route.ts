import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "../../../../lib/auth/current-user";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserIdFromRequest(req);
  return NextResponse.json({ userId });
}
