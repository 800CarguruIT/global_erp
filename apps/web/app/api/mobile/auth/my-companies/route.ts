import { NextRequest } from "next/server";
import { getMobileUserIdFromRequest } from "../../../../../lib/auth/mobile-auth";
import { getUserContext } from "../../../../../lib/auth/user-context";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../utils";

export async function GET(req: NextRequest) {
  const userId = getMobileUserIdFromRequest(req);
  if (!userId) {
    return createMobileErrorResponse("Unauthorized", 401);
  }

  const context = await getUserContext(userId);
  return createMobileSuccessResponse({
    isGlobal: context.isGlobal,
    scope: context.scope,
    companies: context.companies,
    primaryCompany: context.companies?.[0] ?? null,
  });
}
