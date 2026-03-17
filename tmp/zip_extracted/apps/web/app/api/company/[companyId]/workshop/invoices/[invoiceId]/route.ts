import { NextRequest, NextResponse } from "next/server";
import { getInvoiceWithItems } from "@repo/ai-core/workshop/invoices/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; invoiceId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, invoiceId } = await params;
  const data = await getInvoiceWithItems(companyId, invoiceId);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ data });
}
