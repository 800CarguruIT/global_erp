import { NextRequest } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const normalizeStatus = (
  value: string | null,
): "all" | "active" | "inactive" => {
  const next = String(value ?? "").trim().toLowerCase();
  if (next === "active") return "active";
  if (next === "inactive") return "inactive";
  return "all";
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || undefined;
    const branchId = searchParams.get("branchId")?.trim() || undefined;
    const vendorId = searchParams.get("vendorId")?.trim() || undefined;
    const status = normalizeStatus(searchParams.get("status"));
    const limitValue = Number(searchParams.get("limit") ?? 50);
    const offsetValue = Number(searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(200, limitValue))
      : 50;
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;

    const users = await UserRepository.listUsers({
      q,
      limit,
      offset,
      companyId,
      branchId,
      vendorId,
      status,
    });

    return createMobileSuccessResponse({
      users,
      meta: {
        limit,
        offset,
        total: users.length,
        hasMore: users.length >= limit,
      },
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/users error:", error);
    return handleMobileError(error);
  }
}
