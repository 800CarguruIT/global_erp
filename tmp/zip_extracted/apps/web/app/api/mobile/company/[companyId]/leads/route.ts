import { NextRequest } from "next/server";
import { listLeadsForCompany } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "../../../utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    if (!companyId) {
      return createMobileErrorResponse("companyId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase() ?? null;
    const status = searchParams.get("status");
    const leadTypeRaw = searchParams.get("leadType")?.toLowerCase() ?? null;
    const assignedUserId = searchParams.get("assignedUserId");
    const leadType =
      leadTypeRaw && ["rsa", "recovery", "workshop"].includes(leadTypeRaw)
        ? leadTypeRaw
        : null;

    const leads = await listLeadsForCompany(companyId);
    const filtered = leads.filter((l) => {
      if (status && l.leadStatus !== status) return false;
      if (leadType) {
        const currentType = String(
          l.leadType ?? l.lead_type ?? "",
        ).toLowerCase();
        if (currentType !== leadType) return false;
      }
      if (assignedUserId) {
        const currentAssignedUserId = l.assignedUserId ?? l.assigned_user_id;
        if (String(currentAssignedUserId ?? "") !== assignedUserId)
          return false;
      }
      if (!q) return true;
      const hay =
        `${l.customerName ?? ""} ${l.customerPhone ?? ""} ${l.customerEmail ?? ""} ${l.source ?? ""}`.toLowerCase();
      return hay.includes(q);
    });

    const sql = getSql();
    const wallets = await sql`
      SELECT id, wallet_amount
      FROM customers
      WHERE company_id = ${companyId}
    `;
    const walletMap = wallets.reduce(
      (acc: Record<string, number>, row: any) => {
        if (row?.id) acc[row.id] = Number(row.wallet_amount ?? 0);
        return acc;
      },
      {},
    );
    const enriched = filtered.map((lead: any) => ({
      ...lead,
      customerWalletAmount: walletMap[lead?.customerId] ?? 0,
    }));

    return createMobileSuccessResponse({ leads: enriched });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/leads error:", error);
    return handleMobileError(error);
  }
}
