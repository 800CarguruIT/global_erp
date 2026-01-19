import { NextRequest, NextResponse } from "next/server";
import { Crm } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { companyId: string } } | { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { companyId } = await routeCtx.params;
    const url = new URL(req.url);
    const approvedOnly = url.searchParams.get("approvedOnly") !== "false";
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const list = await Crm.listCompanyWalletTopups(companyId, approvedOnly);
    return NextResponse.json({ data: list });
  } catch (error) {
    console.error("GET /api/company/[companyId]/customers/wallet-transactions error:", error);
    return NextResponse.json({ error: "Failed to load wallet transactions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { companyId } = await routeCtx.params;
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const customerId = body?.customerId;
    const amount = Number(body?.amount ?? 0);
    const paymentMethod = body?.paymentMethod ?? "Cash";

    if (!customerId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "customerId and positive amount are required" }, { status: 400 });
    }

    const topup = await Crm.createCustomerWalletTopup({
      companyId,
      customerId,
      amount,
      paymentMethod,
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    const approved = await Crm.approveCustomerWalletTopup(topup.id, userId);
    const balance = await Crm.getCustomerWalletSummary(companyId, customerId);

    return NextResponse.json({ data: { topup: approved, balance: balance.balance } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/customers/wallet-transactions error:", error);
    return NextResponse.json({ error: "Failed to create wallet topup" }, { status: 500 });
  }
}
