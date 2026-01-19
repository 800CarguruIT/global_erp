import { NextRequest, NextResponse } from "next/server";
import {
  listWorkOrdersForCompany,
  createWorkOrderFromEstimate,
  updateWorkOrderHeader,
} from "@repo/ai-core/workshop/workorders/repository";

type Params = { params: Promise<{ companyId: string; branchId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, branchId } = await params;
  const orders = await listWorkOrdersForCompany(companyId, { branchId });
  return NextResponse.json({ data: orders });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, branchId } = await params;
  const body = await req.json().catch(() => ({}));
  const { estimateId } = body ?? {};
  if (!estimateId) {
    return NextResponse.json({ error: "estimateId required" }, { status: 400 });
  }

  const result = await createWorkOrderFromEstimate(companyId, estimateId);
  if (branchId) {
    await updateWorkOrderHeader(companyId, result.workOrder.id, { branchId });
  }
  const withBranch = branchId ? { ...result.workOrder, branchId } : result.workOrder;
  return NextResponse.json({ data: { workOrder: withBranch, items: result.items } }, { status: 201 });
}
