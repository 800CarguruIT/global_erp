import { NextRequest } from "next/server";
import { WorkshopInvoices } from "@repo/ai-core";
import { z } from "zod";
import {
  resolveWorkshopAccess,
  workshopError,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "../../utils";

type ParamsCtx = { params: { invoiceId: string } } | { params: Promise<{ invoiceId: string }> };

const patchInvoiceSchema = z.object({
  status: z.enum(["draft", "issued", "paid", "cancelled"]).optional(),
  invoiceDate: z.string().optional(),
  paymentMethod: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  vatRate: z.number().nonnegative().optional(),
  terms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        lineNo: z.number().int().positive().optional(),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        quantity: z.number().positive(),
        rate: z.number().nonnegative(),
        lineDiscount: z.number().nonnegative().default(0),
      })
    )
    .optional(),
});

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const access = resolveWorkshopAccess(req, "read");
    const { invoiceId } = await ctx.params;
    const data = await WorkshopInvoices.getInvoiceWithItems(access.companyId, invoiceId);
    if (!data) return workshopError("Invoice not found", 404);
    return workshopSuccess({ ...data, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}

export async function PATCH(req: NextRequest, ctx: ParamsCtx) {
  try {
    const access = resolveWorkshopAccess(req, "write");
    const { invoiceId } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = patchInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return workshopError("Invalid payload", 400, { details: parsed.error.format() });
    }

    const patch = parsed.data;
    await WorkshopInvoices.updateInvoiceHeader(access.companyId, invoiceId, {
      status: patch.status,
      invoiceDate: patch.invoiceDate,
      paymentMethod: patch.paymentMethod,
      dueDate: patch.dueDate,
      vatRate: patch.vatRate,
      terms: patch.terms,
      notes: patch.notes,
    });

    if (patch.items) {
      await WorkshopInvoices.replaceInvoiceItems(invoiceId, patch.items);
    }

    const refreshed = await WorkshopInvoices.getInvoiceWithItems(access.companyId, invoiceId);
    if (!refreshed) return workshopError("Invoice not found", 404);
    return workshopSuccess({ ...refreshed, companyId: access.companyId });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
