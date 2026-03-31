import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "./current-user";

type AuthResult =
  | { userId: string; error?: undefined }
  | { userId?: undefined; error: NextResponse };

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId };
}
