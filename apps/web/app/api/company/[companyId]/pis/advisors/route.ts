import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";
import { getSql } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Always compute fresh scores on page load
    const config = await Pis.getConfig(companyId);
    const advisors = await Pis.computeAndStoreScores(companyId, config);
    return NextResponse.json({ advisors });
  } catch (error: any) {
    console.error("PIS advisors error:", error);
    return NextResponse.json({ error: "Failed to load advisors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Debug: check what employees exist
    const sql = getSql();
    const allDepts = await sql<{department: string | null; cnt: number}[]>`
      SELECT department, COUNT(*)::int as cnt FROM employees
      WHERE company_id = ${companyId}
      GROUP BY department ORDER BY cnt DESC
    `;
    console.log("PIS DEBUG - Employee departments:", JSON.stringify(allDepts));

    const matchingEmps = await sql<{full_name: string; department: string | null}[]>`
      SELECT e.full_name, e.department FROM users u
      JOIN employees e ON e.id = u.employee_id
      WHERE e.company_id = ${companyId} AND u.is_active = true AND u.employee_id IS NOT NULL
      LIMIT 20
    `;
    console.log("PIS DEBUG - Active users with employees:", JSON.stringify(matchingEmps));

    const config = await Pis.getConfig(companyId);
    const scores = await Pis.computeAndStoreScores(companyId, config);
    console.log("PIS DEBUG - Computed scores count:", scores.length);
    return NextResponse.json({ advisors: scores });
  } catch (error: any) {
    console.error("PIS compute scores error:", error);
    return NextResponse.json({ error: "Failed to compute scores" }, { status: 500 });
  }
}
