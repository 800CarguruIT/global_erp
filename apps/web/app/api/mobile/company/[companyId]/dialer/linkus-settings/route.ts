import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const v = String(value ?? "").trim();
    if (v) return v;
  }
  return "";
}

function normalizedServerUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let out = raw;
  if (!/^https?:\/\//i.test(out)) out = `https://${out}`;
  out = out.replace(/\/+$/, "");
  out = out.replace(/\/openapi\/v1\.0$/i, "");
  out = out.replace(/\/api\/v1\.0$/i, "");
  return out;
}

async function resolveActiveDialerIntegration(companyId: string): Promise<{
  id: string;
  provider: string;
  credentials: Record<string, any>;
} | null> {
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      provider: string;
      credentials: Record<string, unknown> | null;
      company_id: string | null;
    }[]
  >`
    SELECT id, provider, credentials, company_id
    FROM integration_dialers
    WHERE is_active = TRUE
      AND (company_id = ${companyId} OR company_id IS NULL)
    ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT 1
  `;

  const one = ((rows as any).rows ?? rows)?.[0];
  if (!one?.id) return null;
  return {
    id: String(one.id),
    provider: String(one.provider ?? "").trim().toLowerCase(),
    credentials:
      one.credentials && typeof one.credentials === "object"
        ? (one.credentials as Record<string, any>)
        : {},
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const integration = await resolveActiveDialerIntegration(companyId);
    if (!integration) {
      return createMobileErrorResponse("No active dialer integration found", 404);
    }

    const c = integration.credentials;
    const serverUrl =
      normalizedServerUrl(
        c.linkusServerUrl ??
          c.linkusServer ??
          c.serverUrl ??
          c.pbxURL ??
          c.apiBaseUrl ??
          c.baseUrl ??
          c.apiPath,
      ) ?? null;
    const defaultExtension = pickString(
      c.linkusDefaultExtension,
      c.defaultExtension,
      c.sdkExtension,
      c.extension,
    );

    return createMobileSuccessResponse({
      integrationId: integration.id,
      providerKey: integration.provider || "yeastar",
      serverUrl,
      defaultExtension: defaultExtension || null,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/dialer/linkus-settings error:",
      error,
    );
    return handleMobileError(error);
  }
}

