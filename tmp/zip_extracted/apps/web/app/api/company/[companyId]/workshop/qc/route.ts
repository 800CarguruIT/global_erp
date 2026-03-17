import { NextRequest, NextResponse } from "next/server";
import {
  createQualityCheckForWorkOrder,
  listQualityChecksForCompany,
} from "@repo/ai-core/workshop/qualityCheck/repository";
import type { QualityCheckStatus } from "@repo/ai-core/workshop/qualityCheck/types";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as QualityCheckStatus | null;
  const data = await listQualityChecksForCompany(companyId, {
    status: status ?? undefined,
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.workOrderId) {
    return new NextResponse("workOrderId required", { status: 400 });
  }
  const result = await createQualityCheckForWorkOrder(companyId, body.workOrderId);
  return NextResponse.json({ data: result }, { status: 201 });
}
