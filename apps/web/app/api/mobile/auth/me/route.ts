import { NextRequest } from "next/server";
import { getMobileUserIdFromRequest } from "../../../../../lib/auth/mobile-auth";
import { buildMobileUserProfile } from "../../../../../lib/auth/mobile-user-profile";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../utils";

export async function GET(req: NextRequest) {
  const userId = getMobileUserIdFromRequest(req);
  if (!userId) {
    return createMobileErrorResponse("Unauthorized", 401);
  }

  const user = await buildMobileUserProfile(userId);

  return createMobileSuccessResponse({
    userId,
    user,
    redirect: user?.dashboard?.path ?? null,
  });
}
