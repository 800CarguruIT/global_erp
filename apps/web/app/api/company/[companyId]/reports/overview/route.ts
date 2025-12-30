import { NextRequest, NextResponse } from "next/server";
import { Reports } from "@repo/ai-core/server";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;

  const data = await Reports.getCompanyReportsOverview(companyId);
  return NextResponse.json({ data });
}
