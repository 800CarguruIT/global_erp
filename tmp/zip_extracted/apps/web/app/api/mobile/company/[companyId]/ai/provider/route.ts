import { NextRequest } from "next/server";
import { getCompanyAiProviderConfig, maskApiKey } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    if (!companyId) {
      return createMobileErrorResponse("companyId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const config = await getCompanyAiProviderConfig(companyId);

    return createMobileSuccessResponse({
      companyId,
      provider: "openai",
      configured: Boolean(config?.isActive && config?.apiKey),
      isActive: config?.isActive ?? false,
      baseUrl: config?.baseUrl ?? null,
      apiKeyMasked: maskApiKey(config?.apiKey ?? null),
      updatedAt: config?.updatedAt ?? null,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/ai/provider error:",
      error,
    );
    return handleMobileError(error);
  }
}
