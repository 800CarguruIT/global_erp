import { NextRequest, NextResponse } from "next/server";
import { Integrations } from "@repo/ai-core";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get("companyId");
    if (!companyIdParam) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const companyId = Number(companyIdParam);
    if (Number.isNaN(companyId)) {
      return NextResponse.json(
        { error: "companyId must be a number" },
        { status: 400 }
      );
    }

    const [channels, companyIntegrations, platformIntegrations] =
      await Promise.all([
        Integrations.getIntegrationChannels(),
        Integrations.getCompanyIntegrations(companyId),
        Integrations.getCompanyIntegrations(Integrations.PLATFORM_COMPANY_ID),
      ]);

    const items = channels.map((ch) => {
      const companyPrimary = companyIntegrations.find(
        (ci) => ci.channelKey === ch.key && ci.isPrimary
      );
      const platformPrimary = platformIntegrations.find(
        (ci) => ci.channelKey === ch.key && ci.isPrimary
      );

      const resolved =
        companyPrimary && companyPrimary.enabled
          ? {
              fromCompanyId: companyPrimary.companyId,
              channelKey: companyPrimary.channelKey,
              name: companyPrimary.name,
              provider: companyPrimary.provider,
              settings: companyPrimary.settings,
              isPrimary: true,
            }
          : platformPrimary && platformPrimary.enabled
          ? {
              fromCompanyId: platformPrimary.companyId,
              channelKey: platformPrimary.channelKey,
              name: platformPrimary.name,
              provider: platformPrimary.provider,
              settings: platformPrimary.settings,
              isPrimary: true,
            }
          : null;

      return {
        channel: ch,
        companyIntegration: companyPrimary ?? null,
        platformIntegration: platformPrimary ?? null,
        resolved,
      };
    });

    return NextResponse.json({
      companyId,
      scope:
        companyId === Integrations.PLATFORM_COMPANY_ID ? "global" : "company",
      items,
    });
  } catch (error) {
    console.error("GET /api/integrations/channels error:", error);
    return NextResponse.json(
      { error: "Failed to load channel integrations" },
      { status: 500 }
    );
  }
}
