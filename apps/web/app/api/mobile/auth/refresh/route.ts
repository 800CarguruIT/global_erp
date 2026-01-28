import { NextRequest } from "next/server";
import { createAccessToken, createRefreshToken, verifyToken } from "../../../../../lib/auth/mobile-jwt";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const refreshToken = body?.refreshToken?.toString();
    if (!refreshToken) {
      return createMobileErrorResponse("refreshToken is required", 400);
    }

    const payload = verifyToken(refreshToken, "refresh");
    if (!payload) {
      return createMobileErrorResponse("Invalid refresh token", 401);
    }

    const { token: accessToken, expiresIn } = createAccessToken(payload.sub);
    const { token: newRefreshToken, expiresIn: refreshExpiresIn } = createRefreshToken(payload.sub);

    return createMobileSuccessResponse({
      tokenType: "Bearer",
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      refreshExpiresIn,
    });
  } catch (error: any) {
    console.error("POST /api/mobile/auth/refresh error:", error);
    return createMobileErrorResponse("Failed to refresh");
  }
}
