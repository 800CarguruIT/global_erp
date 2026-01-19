import { NextRequest } from "next/server";
import { verifySessionTokenAsync } from "./session";
import { SESSION_COOKIE_NAME } from "./session-constants";

export async function getCurrentUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionTokenAsync(token);
  return payload?.userId ?? null;
}

export async function requireUserId(req: NextRequest): Promise<string> {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
