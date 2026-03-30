import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearCompanyAiProviderConfig,
  getAllCompanyAiProviderConfigs,
  getCompanyAiProviderConfig,
  maskApiKey,
  upsertCompanyAiProviderConfig,
} from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

const upsertSchema = z.object({
  provider: z.enum(["openai", "anthropic"]).optional(),
  baseUrl: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function formatConfig(config: { companyId: string; provider: string; baseUrl: string | null; apiKey: string | null; isActive: boolean; updatedAt: string } | null, companyId: string, provider: string) {
  return {
    companyId,
    provider,
    configured: Boolean(config?.isActive && config?.apiKey),
    isActive: config?.isActive ?? false,
    baseUrl: config?.baseUrl ?? null,
    apiKeyMasked: maskApiKey(config?.apiKey ?? null),
    updatedAt: config?.updatedAt ?? null,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider");

  // If specific provider requested, return single config
  if (providerParam) {
    const config = await getCompanyAiProviderConfig(companyId, providerParam);
    return NextResponse.json(formatConfig(config, companyId, providerParam));
  }

  // Return all providers
  const configs = await getAllCompanyAiProviderConfigs(companyId);
  const providers = ["openai", "anthropic"];
  const result = providers.map((p) => {
    const config = configs.find((c) => c.provider === p) ?? null;
    return formatConfig(config, companyId, p);
  });

  return NextResponse.json({ providers: result });
}

export async function POST(req: NextRequest, { params }: Params) {
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

  const provider = parsedBody.data.provider ?? "openai";
  const saved = await upsertCompanyAiProviderConfig({
    companyId,
    provider,
    baseUrl: parsedBody.data.baseUrl,
    apiKey: parsedBody.data.apiKey,
    isActive: parsedBody.data.isActive,
  });

  return NextResponse.json(formatConfig(saved, companyId, provider));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? "openai";

  await clearCompanyAiProviderConfig(companyId, provider);
  return NextResponse.json({ success: true });
}
