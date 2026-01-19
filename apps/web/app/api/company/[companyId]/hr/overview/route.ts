import { NextRequest, NextResponse } from "next/server";
import { HrReports } from "@repo/ai-core/server";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const data = await HrReports.getCompanyHrOverview(companyId);
  return NextResponse.json({ data });
}
