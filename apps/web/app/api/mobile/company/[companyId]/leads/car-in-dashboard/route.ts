import { NextRequest } from "next/server";
import { listLeadsForCompany } from "@repo/ai-core/crm/leads/repository";
import { listInvoicesForCompany } from "@repo/ai-core/workshop/invoices/repository";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "../../../../utils";

type Params = { params: Promise<{ companyId?: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId: paramCompanyId } = await params;
    const { searchParams } = new URL(req.url);
    const companyId = paramCompanyId ?? searchParams.get("companyId");
    if (!companyId) {
      return createMobileErrorResponse("companyId is required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const leads = await listLeadsForCompany(companyId);
    const carInLeads = leads.filter((lead) => lead.leadStatus === "car_in");

    const leadIds = carInLeads.map((lead) => lead.id).filter(Boolean);
    const customerIds = carInLeads.map((lead) => lead.customerId ?? lead.customer_id).filter(Boolean);

    const sql = getSql();
    const wallets = customerIds.length
      ? await sql`
          SELECT id, wallet_amount
          FROM customers
          WHERE company_id = ${companyId} AND id = ANY(${customerIds})
        `
      : [];
    const walletMap = wallets.reduce((acc: Record<string, number>, row: any) => {
      if (row?.id) acc[row.id] = Number(row.wallet_amount ?? 0);
      return acc;
    }, {});

    const enrichedLeads = carInLeads.map((lead) => ({
      ...lead,
      customerId: lead.customerId ?? lead.customer_id ?? null,
      customerWalletAmount: walletMap[lead.customerId ?? lead.customer_id ?? ""] ?? 0,
    }));

    const inspections =
      leadIds.length > 0
        ? await sql`
            SELECT
              i.lead_id,
              i.id,
              i.start_at,
              i.complete_at,
              COALESCE(b.display_name, b.name, b.code) AS branch_name
            FROM inspections i
            LEFT JOIN branches b ON b.id = i.branch_id AND b.company_id = ${companyId}
            WHERE i.company_id = ${companyId} AND i.lead_id = ANY(${leadIds})
          `
        : [];

    const estimates =
      leadIds.length > 0
        ? await sql`
            SELECT id, lead_id, inspection_id, status, grand_total
            FROM estimates
            WHERE company_id = ${companyId} AND lead_id = ANY(${leadIds})
          `
        : [];

    const jobCards =
      leadIds.length > 0
        ? await sql`
            SELECT jc.id, jc.lead_id, jc.status, jc.start_at, jc.complete_at
            FROM job_cards jc
            JOIN leads l ON l.id = jc.lead_id
            WHERE l.company_id = ${companyId}
              AND jc.lead_id = ANY(${leadIds})
          `
        : [];

    const parts =
      leadIds.length > 0
        ? await sql`
            SELECT
              i.lead_id,
              COUNT(*) FILTER (WHERE li.order_status = 'Ordered') AS ordered_count,
              COUNT(*) FILTER (WHERE li.order_status = 'Received') AS received_count,
              COUNT(*) FILTER (
                WHERE li.status = 'Approved'
                  AND li.order_status <> 'Received'
                  AND (
                    POSITION('spare' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
                    AND POSITION('part' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
                  )
              ) AS approved_spare_pending_count
            FROM line_items li
            JOIN inspections i ON i.id = li.inspection_id
            LEFT JOIN products p ON p.id = li.product_id
            LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
            WHERE li.company_id = ${companyId}
              AND li.order_status IN ('Ordered', 'Received', 'Returned')
              AND i.lead_id = ANY(${leadIds})
            GROUP BY i.lead_id
          `
        : [];

    const invoices = leadIds.length > 0 ? await listInvoicesForCompany(companyId) : [];
    const invoiceMap =
      invoices.length > 0
        ? invoices.reduce((acc: Record<string, any>, invoice: any) => {
          const leadId = invoice.leadId ?? invoice.lead_id ?? null;
          if (!leadId) return acc;
          acc[leadId] = {
            id: invoice.id,
            status: invoice.status ?? null,
            invoiceNumber: invoice.invoiceNumber ?? invoice.invoice_number ?? null,
            grandTotal: invoice.grandTotal ?? invoice.grand_total ?? null,
          };
          return acc;
        }, {})
        : [];

    const recovery =
      leadIds.length > 0
        ? await sql`
            SELECT
              rr.lead_id,
              rr.id,
              rr.type,
              rr.scheduled_at,
              rr.created_at,
              rr.remarks,
              rr.dropoff_location
            FROM recovery_requests rr
            JOIN leads l ON l.id = rr.lead_id
            WHERE l.company_id = ${companyId}
              AND rr.type = 'dropoff'
              AND rr.lead_id = ANY(${leadIds})
          `
        : [];
        
    const recoveryMap =
      recovery.length > 0
        ? recovery.reduce((acc: Record<string, any>, row: any) => {
          if (!row?.lead_id) return acc;
          const current = acc[row.lead_id];
          const currentTime = current?.created_at ? new Date(current.created_at).getTime() : 0;
          const rowTime = row.created_at ? new Date(row.created_at).getTime() : 0;
          if (!current || rowTime >= currentTime) {
            acc[row.lead_id] = row;
          }
          return acc;
        }, {})
        : [];

    return createMobileSuccessResponse({
      leads: enrichedLeads,
      inspections,
      estimates,
      jobCards,
      parts,
      invoices: invoiceMap,
      recovery: recoveryMap,
    });
  } catch (error) {
    console.error("GET /api/mobile/leads/car-in-dashboard error:", error);
    return handleMobileError(error);
  }
}
