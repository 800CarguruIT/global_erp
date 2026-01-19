import { NextRequest, NextResponse } from "next/server";
import {
  completeQualityCheck,
  getQualityCheckWithItems,
  updateQualityCheckHeader,
  updateQualityCheckItems,
} from "@repo/ai-core/workshop/qualityCheck/repository";
import type { QualityCheckItemStatus, QualityCheckStatus } from "@repo/ai-core/workshop/qualityCheck/types";

type Params = { params: Promise<{ companyId: string; qcId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, qcId } = await params;
  const data = await getQualityCheckWithItems(companyId, qcId);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, qcId } = await params;
  const body = await req.json().catch(() => ({}));

  await updateQualityCheckHeader(companyId, qcId, {
    status: body.status as QualityCheckStatus | undefined,
    testDriveDone: body.testDriveDone as boolean | undefined,
    washDone: body.washDone as boolean | undefined,
    qcRemarks: body.qcRemarks ?? null,
    qcVideoRef: body.qcVideoRef ?? null,
  });

  if (Array.isArray(body.items)) {
    const items = body.items as Array<{ id: string; qcStatus?: QualityCheckItemStatus; qcNote?: string }>;
    await updateQualityCheckItems(companyId, qcId, items);
  }

  if (body.complete) {
    await completeQualityCheck(companyId, qcId);
  }

  return NextResponse.json({ ok: true });
}
