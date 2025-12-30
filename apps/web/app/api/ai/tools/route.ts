import { NextRequest, NextResponse } from "next/server";
import { Dialer } from "@repo/ai-core";
import { tools } from "@repo/ai-tools";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "global";
    const companyId = url.searchParams.get("companyId");

    if (scope === "company" && !companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    const integrations =
      scope === "global"
        ? await Dialer.listGlobalDialers()
        : await Dialer.listCompanyDialers(companyId!);

    const availableIntegrations = integrations
      .filter((i) => i.is_active)
      .map((i) => ({
        id: i.id,
        label: i.label,
        provider: i.provider,
        scope: i.is_global ? "global" : "company",
        companyId: i.company_id,
      }));

    const manifest = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      availableIntegrations,
    }));

    return NextResponse.json({
      scope,
      companyId: scope === "company" ? companyId : null,
      tools: manifest,
    });
  } catch (error: unknown) {
    console.error("GET /api/ai/tools error:", error);
    return NextResponse.json(
      { error: "Failed to load AI tools" },
      { status: 500 }
    );
  }
}
