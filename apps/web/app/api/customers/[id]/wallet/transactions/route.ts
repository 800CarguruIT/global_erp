import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const createSchema = z.object({
  companyId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  paymentProofFileId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const approvedOnly = url.searchParams.get("approvedOnly") !== "false";
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const list = await Crm.listCustomerWalletTopups(companyId, id, approvedOnly);
    return NextResponse.json({ data: list });
  } catch (error) {
    console.error("GET /api/customers/[id]/wallet/transactions error:", error);
    return NextResponse.json({ error: "Failed to load wallet transactions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId: parsed.data.companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const created = await Crm.createCustomerWalletTopup({
      companyId: parsed.data.companyId,
      customerId: id,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod ?? null,
      paymentDate: parsed.data.paymentDate ?? null,
      paymentProofFileId: parsed.data.paymentProofFileId ?? null,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers/[id]/wallet/transactions error:", error);
    return NextResponse.json({ error: "Failed to create wallet transaction" }, { status: 500 });
  }
}
