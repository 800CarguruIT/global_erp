import { NextRequest } from "next/server";
import { Crm } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const toBoolean = (value: string | null) => {
  if (!value) return undefined;
  const next = value.trim().toLowerCase();
  if (["1", "true", "yes", "active"].includes(next)) return true;
  if (["0", "false", "no", "inactive", "archived"].includes(next)) {
    return false;
  }
  return undefined;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const activeOnly = toBoolean(searchParams.get("activeOnly"));

    const cars = await Crm.listCars(companyId, {
      search,
      activeOnly,
    });

    return createMobileSuccessResponse({ cars });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/cars error:", error);
    return handleMobileError(error);
  }
}
