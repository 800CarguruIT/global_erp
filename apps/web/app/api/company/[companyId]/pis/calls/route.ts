import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Crm, Users } from "@repo/ai-core";
import { getSql } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const direction = url.searchParams.get("direction") as "inbound" | "outbound" | null;

  try {
    const sql = getSql();

    // Get service center advisor user IDs
    const advisorRows = await sql<{ user_id: string; full_name: string; mobile: string | null }[]>`
      SELECT u.id as user_id, e.full_name, u.mobile
      FROM users u
      JOIN employees e ON e.id = u.employee_id
      WHERE e.company_id = ${companyId}
        AND e.department = 'Service Center Sales Department'
        AND u.is_active = true
        AND u.employee_id IS NOT NULL
    `;

    const advisorMap = new Map(advisorRows.map(a => [a.user_id, a]));
    const advisorUserIds = advisorRows.map(a => a.user_id);
    const advisorExtensions = new Set(advisorRows.map(a => a.mobile).filter(Boolean));

    if (!advisorUserIds.length) return NextResponse.json({ data: [] });

    // Get all recent calls
    const sessions = await CallCenter.listRecentCalls({
      scope: "company",
      companyId,
      limit: 500,
    });

    // Filter to only calls made by or to service center advisors
    const filtered = sessions.filter((s) => {
      const byAdvisor = advisorUserIds.includes(s.createdByUserId);
      const toAdvisorExt = advisorExtensions.has(s.toNumber) || advisorExtensions.has(s.fromNumber);
      if (!byAdvisor && !toAdvisorExt) return false;
      if (direction && s.direction !== direction) return false;
      return true;
    });

    // Resolve customers
    const uniqueCustomerIds = Array.from(
      new Set(filtered.filter(s => s.toEntityType === "customer" && s.toEntityId).map(s => s.toEntityId as string))
    );
    const customerMap = new Map<string, { name: string | null; phone: string | null }>();
    await Promise.all(
      uniqueCustomerIds.map(async (id) => {
        try {
          const customer = await Crm.getCustomerById(id);
          customerMap.set(id, { name: customer?.name ?? null, phone: (customer as any)?.phone ?? null });
        } catch { customerMap.set(id, { name: null, phone: null }); }
      })
    );

    const payload = filtered.map((s) => {
      const advisor = advisorMap.get(s.createdByUserId);
      const duration = s.durationSeconds ??
        (s.startedAt && s.endedAt ? Math.max(0, Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)) : null);

      const customer = s.toEntityType === "customer" && s.toEntityId
        ? customerMap.get(s.toEntityId) ?? null
        : null;

      return {
        id: s.id,
        direction: s.direction,
        from_number: s.fromNumber ?? "",
        to_number: s.toNumber ?? "",
        status: (s.status === "in_progress" || s.status === "ANSWERED") && duration && duration > 0 ? "completed" : s.status,
        duration_seconds: duration,
        created_at: (s.startedAt ?? s.createdAt)?.toISOString() ?? new Date().toISOString(),
        agent_name: advisor?.full_name ?? null,
        customer_name: customer?.name ?? null,
        customer_phone: customer?.phone ?? null,
      };
    });

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error("PIS calls error:", err);
    return NextResponse.json({ error: "Failed to load calls" }, { status: 500 });
  }
}
