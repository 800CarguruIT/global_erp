import { NextRequest } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { getUserContext } from "../../../../../lib/auth/user-context";
import { getMobileUserIdFromRequest } from "../../../../../lib/auth/mobile-auth";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../utils";

export async function GET(req: NextRequest) {
  const userId = getMobileUserIdFromRequest(req);
  if (!userId) {
    return createMobileErrorResponse("Unauthorized", 401);
  }

  const user = await UserRepository.getUserById(userId);
  const context = await getUserContext(userId);

  return createMobileSuccessResponse({
    userId,
    user: user
      ? {
          id: user.id,
          fullName: user.full_name ?? null,
          email: user.email ?? null,
          isGlobal: context.isGlobal,
          scope: context.scope,
          companies: context.companies[0],
        }
      : null,
  });
}
