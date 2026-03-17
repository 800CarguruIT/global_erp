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
  amount: z.number().positive(),
  paymentMethod: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  paymentProofFileId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ companyId: string; customerId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    const url = new URL(req.url);
    const approvedOnly = url.searchParams.get("approvedOnly") !== "false";

    await ensureCompanyAccess(userId, companyId);

    const list = await Crm.listCustomerWalletTopups(companyId, customerId, approvedOnly);
    return createMobileSuccessResponse({ transactions: list });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/customers/[customerId]/wallet/transactions error:",
      error
    );
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

    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const created = await Crm.createCustomerWalletTopup({
      companyId,
      customerId,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod ?? null,
      paymentDate: parsed.data.paymentDate ?? null,
      paymentProofFileId: parsed.data.paymentProofFileId ?? null,
      notes: parsed.data.notes ?? null,
    });
    return createMobileSuccessResponse({ transaction: created }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/customers/[customerId]/wallet/transactions error:",
      error
    );
    return handleMobileError(error);
  }
}
