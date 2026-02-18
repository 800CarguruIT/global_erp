import { NextRequest } from "next/server";
import { Rbac } from "@repo/ai-core";
import { getMobileUserIdFromRequest } from "../../../../../../lib/auth/mobile-auth";
import { buildScopeContextFromRoute } from "../../../../../../lib/auth/permissions";
import { getUserContext } from "../../../../../../lib/auth/user-context";
import { createMobileErrorResponse, createMobileSuccessResponse } from "../../../utils";

function normalizeId(value: string | null) {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

export async function GET(req: NextRequest) {
  const userId = getMobileUserIdFromRequest(req);
  if (!userId) {
    return createMobileErrorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "global") as
    | "global"
    | "company"
    | "branch"
    | "vendor";

  let companyId = normalizeId(url.searchParams.get("companyId"));
  let branchId = normalizeId(url.searchParams.get("branchId"));
  let vendorId = normalizeId(url.searchParams.get("vendorId"));

  if (scope !== "global" && !companyId) {
    const context = await getUserContext(userId);
    const primary = context.companies?.[0];
    companyId = primary?.companyId ?? undefined;
    branchId = branchId ?? (primary?.branchId ?? undefined);
    vendorId = vendorId ?? (primary?.vendorId ?? undefined);
  }

  if (scope !== "global" && !companyId) {
    return createMobileErrorResponse("companyId is required", 400);
  }

  try {
    const permissions = await Rbac.getUserPermissionsForScope(
      userId,
      buildScopeContextFromRoute(
        { companyId, branchId, vendorId },
        scope
      )
    );
    return createMobileSuccessResponse({ permissions });
  } catch (error) {
    console.error("GET /api/mobile/auth/permissions/me error:", error);
    return createMobileErrorResponse("Failed to load permissions", 500);
  }
}
