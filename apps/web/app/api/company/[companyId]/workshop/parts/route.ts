import { NextRequest, NextResponse } from "next/server";
import { listPartsRequirementsForCompany } from "@repo/ai-core/workshop/parts/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const data = await listPartsRequirementsForCompany(companyId);
  return NextResponse.json({ data });
}
