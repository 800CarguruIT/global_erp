import { NextRequest, NextResponse } from "next/server";
import {
  getGatepassWithSummary,
  updateGatepass,
  approveGatepassPayment,
  releaseGatepassAndCloseLead,
} from "@repo/ai-core/workshop/gatepass/repository";
import type { GatepassHandoverType, GatepassStatus } from "@repo/ai-core/workshop/gatepass/types";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; gatepassId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, gatepassId } = await params;
  try {
    const data = await getGatepassWithSummary(companyId, gatepassId);
    return NextResponse.json({ data });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, gatepassId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.approvePayment) {
    await approveGatepassPayment(companyId, gatepassId, body.approvePayment.supervisorId ?? null);
  }

  await updateGatepass(companyId, gatepassId, {
    handoverType: body.handoverType as GatepassHandoverType | undefined,
    status: body.status as GatepassStatus | undefined,
    paymentOk: body.paymentOk,
    supervisorId: body.supervisorId ?? null,
    supervisorApprovedAt: body.supervisorApprovedAt ?? null,
    customerSigned: body.customerSigned,
    customerName: body.customerName ?? null,
    customerIdNumber: body.customerIdNumber ?? null,
    handoverFormRef: body.handoverFormRef ?? null,
    customerSignatureRef: body.customerSignatureRef ?? null,
    finalVideoRef: body.finalVideoRef ?? null,
    finalNote: body.finalNote ?? null,
  });

  if (body.release) {
    await releaseGatepassAndCloseLead(companyId, gatepassId);
  }

  const refreshed = await getGatepassWithSummary(companyId, gatepassId);
  return NextResponse.json({ data: refreshed?.gatepass });
}
