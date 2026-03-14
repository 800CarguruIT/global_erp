import { NextRequest } from "next/server";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
} from "@/app/api/mobile/utils";

function normalizeCompanyId(value: string | null): string | null {
  const next = value?.trim();
  if (!next || next === "null" || next === "undefined") return null;
  return next;
}

export async function resolveRsaAccess(req: NextRequest): Promise<{
  userId: string;
  companyId: string;
}> {
  const userId = requireMobileUserId(req);
  const companyId =
    normalizeCompanyId(req.nextUrl.searchParams.get("companyId")) ??
    normalizeCompanyId(req.headers.get("x-company-id"));

  if (!companyId) {
    throw new Error("companyId is required");
  }

  await ensureCompanyAccess(userId, companyId);
  return { userId, companyId };
}

export const rsaSuccess = createMobileSuccessResponse;
export const rsaError = createMobileErrorResponse;

export function rsaErrorFromUnknown(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.toLowerCase().includes("unauthorized")) {
    return rsaError(message, 401);
  }
  if (message.toLowerCase().includes("forbidden")) {
    return rsaError(message, 403);
  }
  if (message.toLowerCase().includes("required")) {
    return rsaError(message, 400);
  }
  return rsaError(message, 500);
}
