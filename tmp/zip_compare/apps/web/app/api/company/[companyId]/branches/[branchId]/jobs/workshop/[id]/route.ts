import { NextRequest, NextResponse } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  getWorkOrderWithItems,
  updateWorkOrderHeader,
} from "@repo/ai-core/workshop/workorders/repository";

type Params = { params: Promise<{ companyId: string; branchId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, id } = await params;
  const wo = await getWorkOrderWithItems(companyId, id);
  if (!wo) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data: wo });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, id } = await params;
  const body = await req.json().catch(() => ({}));
  await updateWorkOrderHeader(companyId, id, {
    status: body.status,
    queueReason: body.queueReason,
    workStartedAt: body.workStartedAt,
    workCompletedAt: body.workCompletedAt,
    branchId: body.branchId,
    meta: body.meta,
  });
  const wo = await getWorkOrderWithItems(companyId, id);
  return NextResponse.json({ data: wo });
}
