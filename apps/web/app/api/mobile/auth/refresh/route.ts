import { NextRequest, NextResponse } from "next/server";
import { createAccessToken, createRefreshToken, verifyToken } from "../../../../../lib/auth/mobile-jwt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const refreshToken = body?.refreshToken?.toString();
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
    }

    const payload = verifyToken(refreshToken, "refresh");
    if (!payload) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const { token: accessToken, expiresIn } = createAccessToken(payload.sub);
    const { token: newRefreshToken, expiresIn: refreshExpiresIn } = createRefreshToken(payload.sub);

    return NextResponse.json({
      tokenType: "Bearer",
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      refreshExpiresIn,
    });
  } catch (error: any) {
    console.error("POST /api/mobile/auth/refresh error:", error);
    return NextResponse.json({ error: "Failed to refresh" }, { status: 500 });
  }
}
