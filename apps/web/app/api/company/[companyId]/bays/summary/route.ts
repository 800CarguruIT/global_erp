import { NextRequest, NextResponse } from "next/server";
import { Bays } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const data = await Bays.summarizeBaysByBranch(companyId);
  return NextResponse.json({ data });
}
