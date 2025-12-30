import { NextRequest, NextResponse } from "next/server";
import {
  getInvoiceWithItems,
  replaceInvoiceItems,
  updateInvoiceHeader,
} from "@repo/ai-core/workshop/invoices/repository";
import type { InvoiceItem, InvoiceStatus } from "@repo/ai-core/workshop/invoices/types";

type Params = { params: Promise<{ companyId: string; invoiceId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, invoiceId } = await params;
  const data = await getInvoiceWithItems(companyId, invoiceId);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, invoiceId } = await params;
  const body = await req.json().catch(() => ({}));

  await updateInvoiceHeader(companyId, invoiceId, {
    status: body.status as InvoiceStatus | undefined,
    invoiceDate: body.invoiceDate,
    paymentMethod: body.paymentMethod ?? null,
    dueDate: body.dueDate ?? null,
    vatRate: body.vatRate,
    terms: body.terms ?? null,
    notes: body.notes ?? null,
  });

  if (Array.isArray(body.items)) {
    const items = body.items as Array<{
      id?: string;
      lineNo?: number;
      name: string;
      description?: string | null;
      quantity: number;
      rate: number;
      lineDiscount: number;
    }>;
    await replaceInvoiceItems(
      invoiceId,
      items.map((i, idx) => ({
        id: i.id,
        lineNo: i.lineNo ?? idx + 1,
        name: i.name,
        description: i.description ?? null,
        quantity: i.quantity ?? 0,
        rate: i.rate ?? 0,
        lineDiscount: i.lineDiscount ?? 0,
      })) as unknown as InvoiceItem[]
    );
  }

  return NextResponse.json({ ok: true });
}
