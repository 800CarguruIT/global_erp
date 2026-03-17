"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel, StaffCopilot } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function CompanySalesPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  if (!companyId) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">AI-driven sales intelligence — lead scoring, conversion funnels, and performance tracking.</p>
        </div>
        <AiInsightsPanel companyId={companyId} page="leads" title="Sales Intelligence" showKpis={true} showInsights={true} showSummary={true} kpiColumns={3} onNavigate={(href) => router.push(`/company/${companyId}/${href}`)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <NavCard title="My Leads" desc="View and manage your assigned leads" href={`/company/${companyId}/sales/my-leads`} router={router} />
          <NavCard title="All Leads" desc="Company-wide lead pipeline" href={`/company/${companyId}/leads`} router={router} />
          <NavCard title="Booking" desc="Lead booking calendar" href={`/company/${companyId}/leads/booking`} router={router} />
        </div>
        <StaffCopilot companyId={companyId} currentPage="sales" onNavigate={(href) => router.push(href)} />
      </div>
    </AppLayout>
  );
}

function NavCard({ title, desc, href, router }: { title: string; desc: string; href: string; router: any }) {
  return (
    <button onClick={() => router.push(href)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50 hover:scale-[1.01]">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}
