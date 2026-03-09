import { NextRequest, NextResponse } from "next/server";
import { getIntegrationTokenPayload } from "../../../lib/auth/integration-auth";

type WorkshopScopeMode = "read" | "write";

const READ_SCOPES = ["workshops:read", "workshop:read", "*"];
const WRITE_SCOPES = ["workshops:write", "workshop:write", "*"];

function hasAnyScope(grantedScopeText: string, acceptedScopes: string[]): boolean {
  const granted = new Set(
    grantedScopeText
      .split(" ")
      .map((scope) => scope.trim())
      .filter(Boolean)
  );
  return acceptedScopes.some((scope) => granted.has(scope));
}

function normalizeCompanyId(value: string | null): string | null {
  const normalized = value?.toString().trim();
  if (!normalized || normalized === "null" || normalized === "undefined") return null;
  return normalized;
}

export function resolveWorkshopAccess(
  req: NextRequest,
  mode: WorkshopScopeMode
): { companyId: string; clientId: string; scopes: string[] } {
  const payload = getIntegrationTokenPayload(req);
  if (!payload) {
    throw new Error("Unauthorized");
  }

  const acceptedScopes = mode === "write" ? WRITE_SCOPES : READ_SCOPES;
  if (!hasAnyScope(payload.scope, acceptedScopes)) {
    throw new Error("Forbidden");
  }

  const queryCompanyId = normalizeCompanyId(new URL(req.url).searchParams.get("companyId"));
  const headerCompanyId = normalizeCompanyId(req.headers.get("x-company-id"));
  const companyId = normalizeCompanyId(payload.company_id) ?? headerCompanyId ?? queryCompanyId;
  if (!companyId) {
    throw new Error("company_id is required in token claim or request (x-company-id/companyId)");
  }

  return {
    companyId,
    clientId: payload.client_id,
    scopes: payload.scope
      .split(" ")
      .map((scope) => scope.trim())
      .filter(Boolean),
  };
}

export function workshopSuccess(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function workshopError(message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra ?? {}),
    },
    { status }
  );
}

export function workshopErrorFromUnknown(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "Unauthorized") return workshopError(message, 401);
  if (message === "Forbidden") return workshopError(message, 403);
  if (message.includes("not found") || message.includes("Not found")) {
    return workshopError(message, 404);
  }
  if (message.includes("required")) return workshopError(message, 400);
  return workshopError(message, 500);
}
