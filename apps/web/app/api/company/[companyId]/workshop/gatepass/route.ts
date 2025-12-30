import { NextRequest, NextResponse } from "next/server";
import { listGatepassesForCompany, createGatepassFromInvoice } from "@repo/ai-core/workshop/gatepass/repository";
import type { GatepassStatus, GatepassHandoverType } from "@repo/ai-core/workshop/gatepass/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as GatepassStatus | null;
  const data = await listGatepassesForCompany(companyId, { status: status ?? undefined });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.invoiceId) {
    return new NextResponse("invoiceId required", { status: 400 });
  }
  const handoverType = (body.handoverType as GatepassHandoverType) ?? "branch";
  const gp = await createGatepassFromInvoice(companyId, body.invoiceId, handoverType);
  return NextResponse.json({ data: gp }, { status: 201 });
}
