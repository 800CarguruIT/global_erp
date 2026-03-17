import { NextRequest, NextResponse } from "next/server";
import { Crm } from "@repo/ai-core";
import { getSql } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { companyId: string } } | { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { companyId } = await routeCtx.params;
    const url = new URL(req.url);
    const approvalParam = url.searchParams.get("approval");
    const approvedOnlyParam = url.searchParams.get("approvedOnly");
    const approval = (approvalParam ?? (approvedOnlyParam === null ? "all" : approvedOnlyParam === "false" ? "all" : "approved")).toLowerCase();
    const approvalState =
      approval === "approved" ? "approved" : approval === "unapproved" ? "unapproved" : "all";
    const search = (url.searchParams.get("search") ?? "").trim();
    const paymentMethod = (url.searchParams.get("paymentMethod") ?? "").trim();
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10);
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const result = await Crm.listCompanyWalletTopupsPaged(companyId, {
      approvalState,
      search,
      paymentMethod: paymentMethod && paymentMethod !== "all" ? paymentMethod : undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
    });

    const sql = getSql();
    const kpiRes = await sql<{
      pending_topups: number;
      pending_amount: number;
      approved_today: number;
      approved_amount_today: number;
      approved_mtd: number;
      approved_amount_mtd: number;
      approved_total: number;
      approved_amount_total: number;
      avg_approval_minutes_30d: number;
      approval_rate_30d: number;
    }[]>`
      SELECT
        COUNT(*) FILTER (WHERE approved_at IS NULL)::int AS pending_topups,
        COALESCE(SUM(amount) FILTER (WHERE approved_at IS NULL), 0)::numeric AS pending_amount,
        COUNT(*) FILTER (WHERE approved_at IS NOT NULL AND approved_at::date = current_date)::int AS approved_today,
        COALESCE(SUM(amount) FILTER (WHERE approved_at IS NOT NULL AND approved_at::date = current_date), 0)::numeric AS approved_amount_today,
        COUNT(*) FILTER (
          WHERE approved_at IS NOT NULL
            AND approved_at >= date_trunc('month', now())
        )::int AS approved_mtd,
        COALESCE(
          SUM(amount) FILTER (
            WHERE approved_at IS NOT NULL
              AND approved_at >= date_trunc('month', now())
          ),
          0
        )::numeric AS approved_amount_mtd,
        COUNT(*) FILTER (WHERE approved_at IS NOT NULL)::int AS approved_total,
        COALESCE(SUM(amount) FILTER (WHERE approved_at IS NOT NULL), 0)::numeric AS approved_amount_total,
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 60.0) FILTER (
            WHERE approved_at IS NOT NULL
              AND created_at >= now() - interval '30 days'
          ),
          0
        )::numeric AS avg_approval_minutes_30d,
        COALESCE(
          (
            COUNT(*) FILTER (
              WHERE approved_at IS NOT NULL
                AND created_at >= now() - interval '30 days'
            )::numeric
            / NULLIF(
                COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric,
                0
              )
          ) * 100.0,
          0
        )::numeric AS approval_rate_30d
      FROM customer_wallet_transactions
      WHERE company_id = ${companyId}
    `;
    const paymentMethodRes = await sql<{
      method: string;
      tx_count: number;
      total_amount: number;
      approved_amount: number;
      pending_amount: number;
    }[]>`
      SELECT
        COALESCE(NULLIF(TRIM(payment_method), ''), 'Unknown') AS method,
        COUNT(*)::int AS tx_count,
        COALESCE(SUM(amount), 0)::numeric AS total_amount,
        COALESCE(SUM(amount) FILTER (WHERE approved_at IS NOT NULL), 0)::numeric AS approved_amount,
        COALESCE(SUM(amount) FILTER (WHERE approved_at IS NULL), 0)::numeric AS pending_amount
      FROM customer_wallet_transactions
      WHERE company_id = ${companyId}
      GROUP BY COALESCE(NULLIF(TRIM(payment_method), ''), 'Unknown')
      ORDER BY total_amount DESC
      LIMIT 4
    `;
    const kpiRow = (kpiRes as any)?.rows?.[0] ?? (kpiRes as any)?.[0] ?? {};
    const paymentMethods =
      ((paymentMethodRes as any)?.rows ?? (paymentMethodRes as any) ?? []).map((row: any) => ({
        method: String(row.method ?? "Unknown"),
        txCount: Number(row.tx_count ?? 0),
        totalAmount: Number(row.total_amount ?? 0),
        approvedAmount: Number(row.approved_amount ?? 0),
        pendingAmount: Number(row.pending_amount ?? 0),
      }));
    return NextResponse.json({
      data: result.rows,
      meta: {
        total: result.total,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
      },
      kpis: {
        pendingTopups: Number(kpiRow.pending_topups ?? 0),
        pendingAmount: Number(kpiRow.pending_amount ?? 0),
        approvedToday: Number(kpiRow.approved_today ?? 0),
        approvedAmountToday: Number(kpiRow.approved_amount_today ?? 0),
        approvedMtd: Number(kpiRow.approved_mtd ?? 0),
        approvedAmountMtd: Number(kpiRow.approved_amount_mtd ?? 0),
        approvedTotal: Number(kpiRow.approved_total ?? 0),
        approvedAmountTotal: Number(kpiRow.approved_amount_total ?? 0),
        avgApprovalMinutes30d: Number(kpiRow.avg_approval_minutes_30d ?? 0),
        approvalRate30d: Number(kpiRow.approval_rate_30d ?? 0),
        paymentMethods,
      },
    });
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
