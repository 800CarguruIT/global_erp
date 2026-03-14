import { NextRequest } from "next/server";
import { z } from "zod";
import { CallAiWorkflow, CallCenter } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  sessionId: z.string().optional().nullable(),
  providerCallId: z.string().optional().nullable(),
  providerKey: z.string().default("yeastar"),
  fromNumber: z.string().optional().nullable(),
  toNumber: z.string().optional().nullable(),
  inquirySummary: z.string().optional().nullable(),
  aiPayload: z.record(z.string(), z.unknown()).optional().nullable(),
});

const toText = (value: unknown) => {
  const next = String(value ?? "").trim();
  return next.length ? next : null;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const sessionId = toText(parsed.data.sessionId);
    const requestedProviderCallId = toText(parsed.data.providerCallId);
    const providerKey = toText(parsed.data.providerKey) ?? "yeastar";

    let providerCallId = requestedProviderCallId;
    let fromNumber = toText(parsed.data.fromNumber);
    let toNumber = toText(parsed.data.toNumber);

    if (!providerCallId && sessionId) {
      const session = await CallCenter.getCallSession(sessionId);
      if (!session) {
        return createMobileErrorResponse("Call session not found", 404);
      }
      if (String(session.companyId ?? "") !== companyId) {
        return createMobileErrorResponse("Forbidden", 403);
      }

      providerCallId = toText(session.providerCallId) ?? toText(session.id);
      fromNumber = fromNumber ?? toText(session.fromNumber);
      toNumber = toNumber ?? toText(session.toNumber);
    }

    if (!providerCallId) {
      return createMobileErrorResponse(
        "providerCallId (or sessionId) is required",
        400,
      );
    }

    const inquiry = await CallAiWorkflow.createOrGetInquiryFromCall({
      companyId,
      providerKey,
      providerCallId,
      fromNumber,
      toNumber,
      inquirySummary: toText(parsed.data.inquirySummary),
      aiPayload: parsed.data.aiPayload ?? {},
    });

    return createMobileSuccessResponse({ inquiry }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/call-center/inquiries/from-call error:",
      error,
    );
    return handleMobileError(error);
  }
}

