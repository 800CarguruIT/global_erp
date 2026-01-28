import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getSql, UserRepository } from "@repo/ai-core";
import { createAccessToken, createRefreshToken } from "../../../../../lib/auth/mobile-jwt";
import { getUserContext } from "../../../../../lib/auth/user-context";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../utils";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();
    const password = body?.password?.toString();
    if (!email || !password) {
      return createMobileErrorResponse("email and password are required", 400);
    }

    const sql = getSql();
    const res = await sql<UserRow[]>`
      SELECT id, email, password_hash, is_active
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;
    const user = (res as any).rows ? (res as any).rows[0] : res[0];
    if (!user || user.is_active === false) {
      return createMobileErrorResponse("Invalid credentials", 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return createMobileErrorResponse("Invalid credentials", 401);
    }

    const { token: accessToken, expiresIn } = createAccessToken(user.id);
    const { token: refreshToken, expiresIn: refreshExpiresIn } = createRefreshToken(user.id);
    const context = await getUserContext(user.id);
    const fullUser = await UserRepository.getUserById(user.id);
    if (!fullUser) {
      return createMobileErrorResponse("User profile missing", 500);
    }

    return createMobileSuccessResponse({
      tokenType: "Bearer",
      accessToken,
      refreshToken,
      expiresIn,
      refreshExpiresIn,
      user: {
        id: fullUser.id,
        fullName: fullUser.full_name ?? null,
        email: fullUser.email ?? user.email ?? null,
        isGlobal: context.isGlobal,
        scope: context.scope,
        companies: context.companies[0],
      },
    });
  } catch (error: any) {
    console.error("POST /api/mobile/auth/login error:", error);
    return createMobileErrorResponse("Failed to login");
  }
}
