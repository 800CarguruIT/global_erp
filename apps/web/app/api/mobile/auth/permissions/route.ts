import { NextRequest } from "next/server";
import { Rbac, RbacTypes } from "@repo/ai-core";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../utils";

function normalizeScope(value: string | null): RbacTypes.RoleScope {
  if (value === "company") return "company";
  if (value === "branch") return "branch";
  if (value === "vendor") return "vendor";
  return "global";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = normalizeScope(url.searchParams.get("scope"));
    const permissions = await Rbac.listPermissionsForScope(scope);
    return createMobileSuccessResponse({ permissions });
  } catch (error) {
    console.error("GET /api/mobile/auth/permissions error:", error);
    return createMobileErrorResponse("Failed to load permissions", 500);
  }
}
