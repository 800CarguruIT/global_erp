import { NextRequest, NextResponse } from "next/server";
import { getInvoiceWithItems } from "@repo/ai-core/workshop/invoices/repository";

type Params = { params: Promise<{ companyId: string; invoiceId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, invoiceId } = await params;
  const data = await getInvoiceWithItems(companyId, invoiceId);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ data });
}
