import { NextRequest, NextResponse } from "next/server";
import { createInvoiceFromQualityCheck, listInvoicesForCompany } from "@repo/ai-core/workshop/invoices/repository";
import type { InvoiceStatus } from "@repo/ai-core/workshop/invoices/types";
import type { GatepassHandoverType } from "@repo/ai-core/workshop/gatepass/types";
import { createGatepassFromInvoice } from "@repo/ai-core/workshop/gatepass/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InvoiceStatus | null;
  const data = await listInvoicesForCompany(companyId, { status: status ?? undefined });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.qcId) {
    return new NextResponse("qcId required", { status: 400 });
  }
  const result = await createInvoiceFromQualityCheck(companyId, body.qcId);
  // Optionally auto-create gatepass when invoice created
  if (body.createGatepass) {
    const handoverType = (body.handoverType as GatepassHandoverType) ?? "branch";
    try {
      await createGatepassFromInvoice(companyId, result.invoice.id, handoverType);
    } catch {
      // swallow error to not break invoice creation
    }
  }
  return NextResponse.json({ data: result }, { status: 201 });
}
