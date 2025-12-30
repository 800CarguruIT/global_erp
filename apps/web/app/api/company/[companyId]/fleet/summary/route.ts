import { NextRequest, NextResponse } from "next/server";
import { Fleet } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const data = await Fleet.summarizeFleetByBranch(companyId);
  return NextResponse.json({ data });
}
