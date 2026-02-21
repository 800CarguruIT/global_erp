import { NextRequest } from "next/server";
import { Vendors } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, vendorId } = await params;
    await ensureCompanyAccess(userId, companyId);

    if (!vendorId) {
      return createMobileErrorResponse("vendorId is required", 400);
    }

    const vendor = await Vendors.getVendor(companyId, vendorId);
    if (!vendor) {
      return createMobileErrorResponse("Vendor not found", 404);
    }

    return createMobileSuccessResponse({ vendor });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/vendors/[vendorId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

async function updateVendor(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, vendorId } = await params;
    await ensureCompanyAccess(userId, companyId);

    if (!vendorId) {
      return createMobileErrorResponse("vendorId is required", 400);
    }

    const body = await req.json().catch(() => ({}));
    const updated = await Vendors.updateVendor({
      ...body,
      companyId,
      vendorId,
    });

    return createMobileSuccessResponse({ vendor: updated });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/vendors/[vendorId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Params) {
  return updateVendor(req, ctx);
}

export async function PUT(req: NextRequest, ctx: Params) {
  return updateVendor(req, ctx);
}

