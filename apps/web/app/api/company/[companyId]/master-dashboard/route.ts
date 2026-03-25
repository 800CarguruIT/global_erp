import { NextRequest, NextResponse } from "next/server";
import { MasterDashboard, Users } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;

  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employee } = await Users.getUserWithEmployee(userId);
    if (employee && employee.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    console.warn("Master dashboard company access warning:", err);
  }

  const url = new URL(req.url);
  const to = parseDate(url.searchParams.get("to")) ?? new Date();
  const from =
    parseDate(url.searchParams.get("from")) ??
    new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); // default last 7 days
  const branchId = url.searchParams.get("branchId") || null;

  try {
    const data = await MasterDashboard.getDashboardData({ companyId, branchId, from, to });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/company/[companyId]/master-dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
