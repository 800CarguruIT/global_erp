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

const createSchema = z.object({
  customerType: z.enum(["individual", "corporate"]).default("individual"),
  code: z.string().optional(),
  name: z.string().min(1),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  passportNo: z.string().optional().nullable(),
  legalName: z.string().optional().nullable(),
  tradeLicenseNo: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  phoneAlt: z.string().optional().nullable(),
  whatsappPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ companyId: string }> };

const normalize = (value: string | null) => value?.trim().toLowerCase() ?? "";

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
    if (!companyId) {
      return createMobileErrorResponse("companyId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const search = normalize(searchParams.get("search"));
    const activeOnly = toBoolean(searchParams.get("activeOnly"));

    const rows = await Crm.listCustomersWithSummary(companyId);
    const filtered = rows.filter((item) => {
      if (activeOnly !== undefined && Boolean(item?.is_active) !== activeOnly) {
        return false;
      }
      if (!search) return true;
      const haystack = [item?.code, item?.name, item?.email, item?.phone]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(search);
    });

    return createMobileSuccessResponse({
      customers: filtered,
      meta: { total: filtered.length },
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/customers error:", error);
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    if (!companyId) {
      return createMobileErrorResponse("companyId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const customer = await Crm.createCustomer({
      companyId,
      ...parsed.data,
      name: parsed.data.name.trim(),
    });

    return createMobileSuccessResponse({ customer }, 201);
  } catch (error) {
    console.error("POST /api/mobile/company/[companyId]/customers error:", error);
    return handleMobileError(error);
  }
}
