import { NextRequest } from "next/server";
import { Monitoring } from "@repo/ai-core";
import { buildScopeContextFromRoute } from "./auth/permissions";
import { getCurrentUserIdFromRequest } from "./auth/current-user";

export async function logUserAction(
  req: NextRequest,
  params: {
    actionKey: string;
    entityType?: string;
    entityId?: string;
    summary?: string;
    metadata?: any;
  }
): Promise<void> {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return;
  const url = new URL(req.url);
  const ctx = buildScopeContextFromRoute({
    companyId: url.searchParams.get("companyId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    vendorId: url.searchParams.get("vendorId") ?? undefined,
  });
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? undefined;
  await Monitoring.logActivity({
    userId,
    scopeContext: ctx,
    ipAddress: ip ?? undefined,
    actionKey: params.actionKey,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    summary: params.summary ?? null,
    metadata: params.metadata ?? {},
  });
}

export async function logChange(
  req: NextRequest,
  params: {
    changeType: "create" | "update" | "delete" | "login" | "security";
    entityType: string;
    entityId: string;
    summary?: string;
    beforeData?: any;
    afterData?: any;
  }
): Promise<void> {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return;
  const url = new URL(req.url);
  const ctx = buildScopeContextFromRoute({
    companyId: url.searchParams.get("companyId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    vendorId: url.searchParams.get("vendorId") ?? undefined,
  });
  await Monitoring.logChange({
    userId,
    sessionId: null,
    scopeContext: ctx,
    entityType: params.entityType,
    entityId: params.entityId,
    changeType: params.changeType,
    summary: params.summary ?? null,
    beforeData: params.beforeData ?? null,
    afterData: params.afterData ?? null,
  });
}
