import { NextRequest } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

const linkSchema = z.object({
  relationType: z.enum(["owner", "driver", "other"]),
  priority: z.number().int().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  existingCarId: z.string().optional(),
  newCar: z
    .object({
      code: z.string().optional(),
      plateNumber: z.string().optional().nullable(),
      plateCode: z.string().optional().nullable(),
      plateCountry: z.string().optional().nullable(),
      plateState: z.string().optional().nullable(),
      plateCity: z.string().optional().nullable(),
      plateLocationMode: z.enum(["state", "city", "both"]).optional().nullable(),
      vin: z.string().optional().nullable(),
      make: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      modelYear: z.number().optional().nullable(),
      color: z.string().optional().nullable(),
      bodyType: z.string().optional().nullable(),
      isInsurance: z.boolean().optional().nullable(),
      mileage: z.number().optional().nullable(),
      tyreSizeFront: z.string().optional().nullable(),
      tyreSizeBack: z.string().optional().nullable(),
      registrationExpiry: z.string().optional().nullable(),
      registrationCardFileId: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .optional(),
});

type Params = { params: Promise<{ companyId: string; customerId: string }> };

async function requireCustomer(companyId: string, customerId: string) {
  const customer = await Crm.getCustomerWithCars(customerId);
  if (!customer) {
    return { error: "Customer not found", status: 404 };
  }
  if (customer.company_id !== companyId) {
    return { error: "Forbidden", status: 403 };
  }
  return { customer };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const customerResult = await requireCustomer(companyId, customerId);
    if ("error" in customerResult) {
      return createMobileErrorResponse(customerResult.error, customerResult.status);
    }

    return createMobileSuccessResponse({ cars: customerResult.customer.cars ?? [] });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/customers/[customerId]/cars error:", error);
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const customerResult = await requireCustomer(companyId, customerId);
    if ("error" in customerResult) {
      return createMobileErrorResponse(customerResult.error, customerResult.status);
    }

    const json = await req.json();
    const parsed = linkSchema.safeParse(json);
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    let carId = parsed.data.existingCarId ?? null;
    if (!carId && parsed.data.newCar) {
      const car = await Crm.createCar({
        companyId,
        ...parsed.data.newCar,
      });
      carId = car.id;
    }
    if (!carId) {
      return createMobileErrorResponse("carId or newCar required", 400);
    }

    const link = await Crm.linkCustomerToCar({
      companyId,
      customerId,
      carId,
      relationType: parsed.data.relationType,
      priority: parsed.data.priority,
      isPrimary: parsed.data.isPrimary,
      notes: parsed.data.notes ?? null,
    });
    return createMobileSuccessResponse({ link }, 201);
  } catch (error) {
    console.error("POST /api/mobile/company/[companyId]/customers/[customerId]/cars error:", error);
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    const url = new URL(req.url);
    const linkId = url.searchParams.get("linkId");
    if (!linkId) {
      return createMobileErrorResponse("linkId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const customerResult = await requireCustomer(companyId, customerId);
    if ("error" in customerResult) {
      return createMobileErrorResponse(customerResult.error, customerResult.status);
    }

    const json = await req.json();
    const parsed = linkSchema.partial().safeParse(json);
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const updated = await Crm.updateCustomerCarLink(linkId, {
      relationType: parsed.data.relationType,
      priority: parsed.data.priority,
      isPrimary: parsed.data.isPrimary,
      notes: parsed.data.notes ?? null,
    });
    return createMobileSuccessResponse({ link: updated });
  } catch (error) {
    console.error("PATCH /api/mobile/company/[companyId]/customers/[customerId]/cars error:", error);
    return handleMobileError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    const url = new URL(req.url);
    const linkId = url.searchParams.get("linkId");
    if (!linkId) {
      return createMobileErrorResponse("linkId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const customerResult = await requireCustomer(companyId, customerId);
    if ("error" in customerResult) {
      return createMobileErrorResponse(customerResult.error, customerResult.status);
    }

    await Crm.unlinkCustomerFromCar(linkId);
    return createMobileSuccessResponse({ success: true });
  } catch (error) {
    console.error("DELETE /api/mobile/company/[companyId]/customers/[customerId]/cars error:", error);
    return handleMobileError(error);
  }
}
