import { NextRequest } from "next/server";
import { Rbac } from "@repo/ai-core";
import type { RbacTypes } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const normalizeScope = (value: string | null): RbacTypes.RoleScope => {
  const next = String(value ?? "").trim().toLowerCase();
  if (next === "branch") return "branch";
  if (next === "vendor") return "vendor";
  if (next === "global") return "global";
  return "company";
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const scope = normalizeScope(searchParams.get("scope"));
    const branchId = searchParams.get("branchId")?.trim() || undefined;
    const vendorId = searchParams.get("vendorId")?.trim() || undefined;

    const roles = await Rbac.listRolesForScope({
      scope,
      companyId,
      branchId,
      vendorId,
    });

    return createMobileSuccessResponse({ roles });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/roles error:", error);
    return handleMobileError(error);
  }
}
