import { NextRequest } from "next/server";
import { listLeadsForCompany } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase() ?? null;
    const status = searchParams.get("status");
    const branchId = searchParams.get("branchId");

    const leads = await listLeadsForCompany(companyId);
    const filtered = leads.filter((lead: any) => {
      if (status && lead.leadStatus !== status) return false;
      if (branchId && lead.branchId !== branchId) return false;
      if (!q) return true;

      const haystack = `${lead.customerName ?? ""} ${lead.customerPhone ?? ""} ${lead.customerEmail ?? ""} ${
        lead.source ?? ""
      }`.toLowerCase();
      return haystack.includes(q);
    });

    const sql = getSql();
    const wallets = await sql`
      SELECT id, wallet_amount
      FROM customers
      WHERE company_id = ${companyId}
    `;
    const walletMap = wallets.reduce((acc: Record<string, number>, row: any) => {
      if (row?.id) acc[row.id] = Number(row.wallet_amount ?? 0);
      return acc;
    }, {});

    const enriched = filtered.map((lead: any) => ({
      ...lead,
      customerWalletAmount: walletMap[lead.customerId] ?? 0,
    }));

    return createMobileSuccessResponse({ leads: enriched });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/workshop/leads error:", error);
    return handleMobileError(error);
  }
}
