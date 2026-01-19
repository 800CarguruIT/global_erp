import { NextRequest, NextResponse } from "next/server";
import { createEstimateFromInspection, listEstimatesForCompany } from "@repo/ai-core/workshop/estimates/repository";
import type { EstimateStatus } from "@repo/ai-core/workshop/estimates/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as EstimateStatus | null;

  const estimates = await listEstimatesForCompany(companyId, {
    status: status ?? undefined,
  });

  return NextResponse.json({ data: estimates });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const inspectionId = body.inspectionId;
  if (!inspectionId) {
    return new NextResponse("inspectionId required", { status: 400 });
  }

  const result = await createEstimateFromInspection(companyId, inspectionId);
  return NextResponse.json({ data: result }, { status: 201 });
}
