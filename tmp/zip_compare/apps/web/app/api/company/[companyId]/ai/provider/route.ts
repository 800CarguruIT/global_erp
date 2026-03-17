import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  clearCompanyAiProviderConfig,
  getCompanyAiProviderConfig,
  maskApiKey,
  upsertCompanyAiProviderConfig,
} from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

const upsertSchema = z.object({
  baseUrl: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const config = await getCompanyAiProviderConfig(companyId);
  return NextResponse.json({
    companyId,
    provider: "openai",
    configured: Boolean(config?.isActive && config?.apiKey),
    isActive: config?.isActive ?? false,
    baseUrl: config?.baseUrl ?? null,
    apiKeyMasked: maskApiKey(config?.apiKey ?? null),
    updatedAt: config?.updatedAt ?? null,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const parsedBody = upsertSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsedBody.error.format() },
      { status: 400 }
    );
  }

  const saved = await upsertCompanyAiProviderConfig({
    companyId,
    baseUrl: parsedBody.data.baseUrl,
    apiKey: parsedBody.data.apiKey,
    isActive: parsedBody.data.isActive,
  });

  return NextResponse.json({
    companyId,
    provider: "openai",
    configured: Boolean(saved?.isActive && saved?.apiKey),
    isActive: saved?.isActive ?? false,
    baseUrl: saved?.baseUrl ?? null,
    apiKeyMasked: maskApiKey(saved?.apiKey ?? null),
    updatedAt: saved?.updatedAt ?? null,
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  await clearCompanyAiProviderConfig(companyId);
  return NextResponse.json({ success: true });
}
