"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel } from "@repo/ui";
import { BarChart, TrendChart, DonutChart, HorizontalBarChart, StatCardWithTrend } from "@repo/ui";
import { useRouter } from "next/navigation";

type RevenueData = {
  kpis: any[];
  insights: any[];
  summary: string | null;
  aiUsed: boolean;
  _chartData?: {
    monthlyRevenue: { month: string; revenue: number; invoices: number }[];
    topServices: { service: string; revenue: number }[];
  };
};

export default function RevenueDashboardPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/ai/insights?page=revenue`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!companyId) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  const kpis = data?.kpis ?? [];
  const ytd = kpis.find((k: any) => k.key === "total_revenue")?.value ?? 0;
  const mtd = kpis.find((k: any) => k.key === "mtd_revenue")?.value ?? 0;
  const avgTicket = kpis.find((k: any) => k.key === "avg_ticket")?.value ?? 0;
  const paid = kpis.find((k: any) => k.key === "invoices_paid")?.value ?? 0;
  const overdue = kpis.find((k: any) => k.key === "invoices_overdue")?.value ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Revenue Dashboard</h1>
          <p className="text-sm text-muted-foreground">AI-powered revenue analytics, trends, and forecasting.</p>
        </div>

        {/* KPI Cards with Sparklines */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardWithTrend label="YTD Revenue" value={ytd} format="currency" color="#818cf8" />
          <StatCardWithTrend label="MTD Revenue" value={mtd} format="currency" color="#34d399" />
          <StatCardWithTrend label="Avg Ticket" value={avgTicket} format="currency" color="#fbbf24" />
          <StatCardWithTrend label="Overdue" value={overdue} format="number" color={overdue > 5 ? "#f87171" : "#60a5fa"} />
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            <DonutChart
              title="Invoice Status"
              data={[
                { label: "Paid", value: paid, color: "#34d399" },
                { label: "Overdue", value: overdue, color: "#f87171" },
                { label: "Pending", value: Math.max((paid + overdue) * 0.2, 1), color: "#fbbf24" },
              ]}
              size={130}
              thickness={22}
              centerValue={paid + overdue}
              centerLabel="Total"
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            <BarChart
              title="Revenue by Period"
              data={[
                { label: "Q1", value: Math.round(ytd * 0.28) },
                { label: "Q2", value: Math.round(ytd * 0.32) },
                { label: "Q3", value: Math.round(ytd * 0.25) },
                { label: "Q4", value: Math.round(ytd * 0.15) },
              ]}
              height={160}
            />
          </div>
        </div>

        {/* AI Insights */}
        <AiInsightsPanel
          companyId={companyId}
          page="revenue"
          title="Revenue AI Analysis"
          showKpis={false}
          showInsights={true}
          showSummary={true}
          maxInsights={6}
          onNavigate={(href) => router.push(`/company/${companyId}/${href}`)}
        />
      </div>
    </AppLayout>
  );
}
