import { NextRequest } from "next/server";
import { Crm } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; carId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, carId } = await params;
    if (!companyId || !carId) {
      return createMobileErrorResponse("companyId and carId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const car = await Crm.getCarWithCustomers(carId);
    if (!car) {
      return createMobileErrorResponse("Car not found", 404);
    }
    if (car.company_id !== companyId) {
      return createMobileErrorResponse("Forbidden", 403);
    }

    const customerEntries = Array.isArray((car as any).customers)
      ? (car as any).customers.filter(
          (entry: any) =>
            // entry?.link?.is_active !== false &&
            // entry?.customer?.is_active !== false &&
            entry?.customer?.company_id === companyId,
        )
      : [];

    const primaryEntry =
      customerEntries.find((entry: any) => entry?.link?.is_primary) ??
      customerEntries[0] ??
      null;

    return createMobileSuccessResponse({
      ...car,
      customer: primaryEntry?.customer ?? null,
      link: primaryEntry?.link ?? null,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/cars/[carId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
