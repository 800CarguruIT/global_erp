import { NextRequest, NextResponse } from "next/server";
import { Dialer, DialerTypes } from "@repo/ai-core";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const integration = await Dialer.getDialerById(id);
    if (!integration) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(integration);
  } catch (error) {
    console.error("GET /api/dialer/integrations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load dialer integration" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<DialerTypes.SaveDialerInput> & {
      scope?: "global" | "company";
    };

    if (!body.provider || !body.label || !body.authType) {
      return NextResponse.json(
        { error: "provider, label, and authType are required" },
        { status: 400 }
      );
    }

    const isGlobal = body.scope === "global" || body.isGlobal === true;
    const companyId = isGlobal ? null : body.companyId ?? null;

    if (!isGlobal && !companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    const input: DialerTypes.SaveDialerInput = {
      id,
      provider: body.provider,
      label: body.label,
      authType: body.authType,
      credentials: body.credentials ?? {},
      isGlobal,
      companyId,
      isActive: body.isActive ?? true,
      metadata: body.metadata,
      webhooks: body.webhooks,
    };

    const updated = await Dialer.saveDialerIntegration(input);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/dialer/integrations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update dialer integration" },
      { status: 500 }
    );
  }
}
