import { NextRequest, NextResponse } from "next/server";
import { MarketingSettings } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const settings = await MarketingSettings.getCompanyMarketingSettings(companyId);
  if (!settings) {
    return NextResponse.json({
      data: {
        companyId,
        easycronApiKey: null,
        easycronTimezone: null,
        scheduleLaunch: true,
        scheduleDelay: true,
      },
    });
  }
  return NextResponse.json({ data: settings });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const saved = await MarketingSettings.upsertCompanyMarketingSettings(companyId, body);
  return NextResponse.json({ data: saved });
}

export const PUT = PATCH;
