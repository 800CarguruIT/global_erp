import { NextRequest, NextResponse } from "next/server";
import { Dialer, DialerTypes } from "@repo/ai-core";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "company";
    const companyId = url.searchParams.get("companyId");

    if (scope === "global") {
      const items = await Dialer.listGlobalDialers();
      return NextResponse.json({ scope: "global", items });
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    const items = await Dialer.listCompanyDialers(companyId);
    return NextResponse.json({ scope: "company", companyId, items });
  } catch (error) {
    console.error("GET /api/dialer/integrations error:", error);
    // Graceful fallback so UI can render empty state instead of hard fail
    return NextResponse.json({ scope: "global", items: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const integration = await Dialer.saveDialerIntegration(input);

    return NextResponse.json(
      {
        id: integration.id,
        provider: integration.provider,
        label: integration.label,
        authType: integration.auth_type,
        isGlobal: integration.is_global,
        companyId: integration.company_id,
        isActive: integration.is_active,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/dialer/integrations error:", error);
    return NextResponse.json(
      { error: "Failed to create dialer integration" },
      { status: 500 }
    );
  }
}
