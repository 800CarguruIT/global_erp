import { NextRequest } from "next/server";
import { verifyToken } from "./mobile-jwt";

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim();
}

export function getMobileUserIdFromRequest(req: NextRequest): string | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token, "access");
  return payload?.sub ?? null;
}

export function requireMobileUserId(req: NextRequest): string {
  const userId = getMobileUserIdFromRequest(req);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
