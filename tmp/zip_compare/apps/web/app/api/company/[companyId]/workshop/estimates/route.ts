import { NextRequest, NextResponse } from "next/server";
import { createEstimateFromInspection, listEstimatesForCompany } from "@repo/ai-core/workshop/estimates/repository";
import type { EstimateStatus } from "@repo/ai-core/workshop/estimates/types";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as EstimateStatus | null;
  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 200000;

  const estimates = await listEstimatesForCompany(companyId, {
    status: status ?? undefined,
    limit,
  });

  return NextResponse.json({ data: estimates });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const inspectionId = body.inspectionId;
  if (!inspectionId) {
    return new NextResponse("inspectionId required", { status: 400 });
  }

  const result = await createEstimateFromInspection(companyId, inspectionId);
  return NextResponse.json({ data: result }, { status: 201 });
}
