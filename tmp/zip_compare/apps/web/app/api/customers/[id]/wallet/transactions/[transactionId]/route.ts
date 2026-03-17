import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm, UserRepository } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";

const approveSchema = z.object({
  companyId: z.string(),
  approved: z.boolean(),
});

type ParamsCtx =
  | { params: { id: string; transactionId: string } }
  | { params: Promise<{ id: string; transactionId: string }> };

export async function PATCH(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { transactionId } = await routeCtx.params;
    const json = await req.json();
    const parsed = approveSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }
    if (!parsed.data.approved) {
      return NextResponse.json({ error: "Only approve=true is supported" }, { status: 400 });
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId: parsed.data.companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const currentUserId = await getCurrentUserIdFromRequest(req);
    const updated = await Crm.approveCustomerWalletTopup(transactionId, currentUserId);
    let approvedByName: string | null = null;
    if (currentUserId) {
      const user = await UserRepository.getUserById(currentUserId);
      approvedByName = (user?.full_name ?? user?.email ?? null) as string | null;
    }
    return NextResponse.json({ ...updated, approved_by_name: approvedByName });
  } catch (error) {
    console.error("PATCH /api/customers/[id]/wallet/transactions/[transactionId] error:", error);
    return NextResponse.json({ error: "Failed to approve wallet transaction" }, { status: 500 });
  }
}
