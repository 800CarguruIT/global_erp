import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };

const updateSchema = z.object({
  serverUrl: z.string().url().optional().nullable(),
  defaultExtension: z.string().optional().nullable(),
});

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

async function resolveActiveYeastarIntegration(companyId: string): Promise<{
  id: string;
  credentials: Record<string, any>;
} | null> {
  const sql = getSql();
  const rows = await sql<
    { id: string; credentials: Record<string, unknown> | null; company_id: string | null }[]
  >`
    SELECT id, credentials, company_id
    FROM integration_dialers
    WHERE provider = 'yeastar'
      AND is_active = TRUE
      AND (company_id = ${companyId} OR company_id IS NULL)
    ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT 1
  `;
  const one = ((rows as any).rows ?? rows)?.[0];
  if (!one?.id) return null;
  const credentials =
    one.credentials && typeof one.credentials === "object"
      ? (one.credentials as Record<string, any>)
      : {};
  return { id: String(one.id), credentials };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await resolveActiveYeastarIntegration(companyId);
  if (!integration) {
    return NextResponse.json({ error: "No active Yeastar integration found" }, { status: 404 });
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
        c.apiPath
    ) ?? null;
  const defaultExtension = pickString(
    c.linkusDefaultExtension,
    c.defaultExtension,
    c.sdkExtension,
    c.extension
  );

  return NextResponse.json({
    ok: true,
    integrationId: integration.id,
    serverUrl,
    defaultExtension: defaultExtension || null,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const integration = await resolveActiveYeastarIntegration(companyId);
  if (!integration) {
    return NextResponse.json({ error: "No active Yeastar integration found" }, { status: 404 });
  }

  const nextServerUrl = normalizedServerUrl(parsed.data.serverUrl);
  const nextDefaultExt = String(parsed.data.defaultExtension ?? "").trim();
  const nextCredentials = {
    ...(integration.credentials ?? {}),
    linkusServerUrl: nextServerUrl ?? null,
    linkusDefaultExtension: nextDefaultExt || null,
  };

  const sql = getSql();
  await sql`
    UPDATE integration_dialers
    SET credentials = ${JSON.stringify(nextCredentials)}::jsonb,
        updated_at = now()
    WHERE id = ${integration.id}
  `;

  return NextResponse.json({
    ok: true,
    integrationId: integration.id,
    serverUrl: nextServerUrl,
    defaultExtension: nextDefaultExt || null,
  });
}
