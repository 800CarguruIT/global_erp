import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Dialer } from "@repo/ai-core/server";

type Params = { params: Promise<{ companyId: string }> };

function todayRange() {
  const to = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { from, to } = todayRange();

  const dashboard = await CallCenter.getDashboardData({
    scope: "company",
    companyId,
    from,
    to,
  });

  const recentCalls = await CallCenter.listRecentCalls({
    scope: "company",
    companyId,
    limit: 20,
  });

  const dialers = await Dialer.listCompanyDialers(companyId);

  return NextResponse.json({
    stats: {
      totalCallsToday: dashboard.totals.totalCalls,
      answeredToday: dashboard.totals.completedCalls,
      missedToday: dashboard.totals.failedCalls,
      outboundToday:
        dashboard.byDirection.find((d) => d.direction === "outbound")?.count ?? 0,
    },
    recentCalls: recentCalls.map((c: any) => ({
      id: c.id,
      from: c.fromNumber,
      to: c.toNumber,
      direction: c.direction,
      status: c.status,
      startedAt: c.createdAt,
      durationSeconds: c.durationSeconds ?? null,
    })),
    activeDialers: dialers.map((d) => ({
      id: d.id,
      label: d.label,
      provider: d.provider,
    })),
  });
}
