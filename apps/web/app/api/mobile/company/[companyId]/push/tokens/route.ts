import { NextRequest } from "next/server";
import { z } from "zod";
import { Push } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const registerSchema = z.object({
  deviceToken: z.string().min(10),
  platform: z.string().optional().nullable(),
  deviceId: z.string().optional().nullable(),
});

const unregisterSchema = z.object({
  deviceToken: z.string().min(10),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const parsed = registerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const token = await Push.registerPushDeviceToken({
      scope: "company",
      companyId,
      userId,
      deviceToken: parsed.data.deviceToken,
      platform: parsed.data.platform ?? null,
      deviceId: parsed.data.deviceId ?? null,
      isActive: true,
    });

    return createMobileSuccessResponse({ token }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/push/tokens error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const parsed = unregisterSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const removed = await Push.unregisterPushDeviceToken(
      parsed.data.deviceToken,
      userId,
    );
    if (!removed) {
      return createMobileErrorResponse("Token not found", 404);
    }

    return createMobileSuccessResponse({ success: true });
  } catch (error) {
    console.error(
      "DELETE /api/mobile/company/[companyId]/push/tokens error:",
      error,
    );
    return handleMobileError(error);
  }
}
