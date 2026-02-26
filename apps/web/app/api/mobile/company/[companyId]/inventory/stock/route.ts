import { NextRequest } from "next/server";
import { listStock } from "@repo/ai-core/workshop/inventory/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const q = searchParams.get("q");
    const typeId = searchParams.get("typeId");
    const categoryId = searchParams.get("categoryId");
    const subcategoryId = searchParams.get("subcategoryId");
    const makeId = searchParams.get("makeId");
    const modelId = searchParams.get("modelId");
    const yearId = searchParams.get("yearId");

    const stock = await listStock(companyId, {
      locationId: locationId ?? undefined,
      search: q ?? undefined,
      typeId: typeId ?? undefined,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
      makeId: makeId ?? undefined,
      modelId: modelId ?? undefined,
      yearId: yearId ?? undefined,
    });

    return createMobileSuccessResponse({ stock });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/inventory/stock error:",
      error,
    );
    return handleMobileError(error);
  }
}
