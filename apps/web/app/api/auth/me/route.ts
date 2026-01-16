import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../lib/auth/current-user";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserIdFromRequest(req);
  const user = userId ? await UserRepository.getUserById(userId) : null;
  return NextResponse.json({
    userId,
    user: user
      ? {
          id: user.id,
          fullName: user.full_name ?? null,
          email: user.email ?? null,
        }
      : null,
  });
}
