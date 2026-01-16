import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { getUserContext } from "../../../../../lib/auth/user-context";
import { getMobileUserIdFromRequest } from "../../../../../lib/auth/mobile-auth";

export async function GET(req: NextRequest) {
  const userId = getMobileUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await UserRepository.getUserById(userId);
  const context = await getUserContext(userId);

  return NextResponse.json({
    userId,
    user: user
      ? {
          id: user.id,
          fullName: user.full_name ?? null,
          email: user.email ?? null,
        }
      : null,
    context,
  });
}
