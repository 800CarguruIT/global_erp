import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "./current-user";

/**
 * Guard for API routes that require authentication.
 * Returns a 401 response if not authenticated, or the userId if authenticated.
 *
 * Usage in API routes:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const auth = await requireAuth(req);
 *   if (auth.error) return auth.error;
 *   const userId = auth.userId;
 *   // ... handle request
 * }
 * ```
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  return { userId };
}
