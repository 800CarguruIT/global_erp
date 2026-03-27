import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().min(1),
  username: z.string().min(1),
  password: z.string().optional().default(""),
  usernameParam: z.string().optional().default("user"),
  signatureParam: z.string().optional().default("token"),
});

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCredentials(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }
  return {};
}

async function findVin17Integration(companyId: string) {
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      credentials: Record<string, unknown> | null;
      is_active: boolean;
    }[]
  >`
    SELECT id, credentials, is_active
    FROM integration_dialers
    WHERE provider = 'vin17'
      AND company_id = ${companyId}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;
  return ((rows as any).rows ?? rows)?.[0] ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const row = await findVin17Integration(companyId);
  const credentials = normalizeCredentials(row?.credentials);

  return NextResponse.json({
    ok: true,
    provider: "vin17",
    enabled: Boolean(row?.is_active ?? false),
    baseUrl: clean(credentials.baseUrl ?? process.env.VIN17_BASE_URL),
    username: clean(credentials.username ?? process.env.VIN17_USERNAME),
    usernameParam: clean(credentials.usernameParam ?? process.env.VIN17_USERNAME_PARAM ?? "user") || "user",
    signatureParam:
      clean(credentials.signatureParam ?? process.env.VIN17_SIGNATURE_PARAM ?? "token") || "token",
    hasPassword: Boolean(clean(credentials.password ?? "").length || clean(process.env.VIN17_PASSWORD).length),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const existing = await findVin17Integration(companyId);
  const existingCreds = normalizeCredentials(existing?.credentials);

  const passwordInput = clean(parsed.data.password);
  const resolvedPassword = passwordInput || clean(existingCreds.password);
  if (!resolvedPassword) {
    return NextResponse.json(
      { error: "Password is required for first-time setup." },
      { status: 400 }
    );
  }

  const credentials = {
    baseUrl: clean(parsed.data.baseUrl),
    username: clean(parsed.data.username),
    password: resolvedPassword,
    usernameParam: clean(parsed.data.usernameParam) || "user",
    signatureParam: clean(parsed.data.signatureParam) || "token",
  };

  const sql = getSql();
  if (existing?.id) {
    await sql`
      UPDATE integration_dialers
      SET label = '17VIN',
          auth_type = 'basic',
          credentials = ${credentials},
          is_active = ${parsed.data.enabled ?? true},
          updated_at = now()
      WHERE id = ${existing.id}
    `;
  } else {
    await sql`
      INSERT INTO integration_dialers (
        provider,
        label,
        auth_type,
        credentials,
        is_global,
        company_id,
        is_active
      )
      VALUES (
        'vin17',
        '17VIN',
        'basic',
        ${credentials},
        FALSE,
        ${companyId},
        ${parsed.data.enabled ?? true}
      )
    `;
  }

  return NextResponse.json({
    ok: true,
    provider: "vin17",
    enabled: parsed.data.enabled ?? true,
    baseUrl: credentials.baseUrl,
    username: credentials.username,
    usernameParam: credentials.usernameParam,
    signatureParam: credentials.signatureParam,
    hasPassword: true,
  });
}
