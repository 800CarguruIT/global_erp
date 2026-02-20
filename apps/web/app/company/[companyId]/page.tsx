import Link from "next/link";
import { Reports } from "@repo/ai-core/server";
import { AppLayout, KpiGrid } from "@repo/ui";
import { redirect } from "next/navigation";

type Props = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyHomePage({ params }: Props) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId?.toString?.();

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  try {
    const res = await fetch("/api/auth/my-companies", { cache: "no-store" });
    if (res.ok) {
      const ctx = (await res.json()) as {
        companies?: Array<{ companyId?: string; branchId?: string }>;
      };
      const entry = (ctx.companies ?? []).find((c) => c.companyId === companyId);
      if (entry?.branchId) {
        return redirect(`/company/${companyId}/branches/${entry.branchId}`);
      }
    }

    const branchesRes = await fetch(`/api/company/${companyId}/branches`, { cache: "no-store" });
    if (branchesRes.ok) {
      const data = (await branchesRes.json()) as
        | { branches?: Array<{ id?: string }> }
        | Array<{ id?: string }>;
      const branches = Array.isArray(data)
        ? data
        : Array.isArray(data.branches)
        ? data.branches
        : [];
      const firstId = branches[0]?.id;
      if (firstId) {
        return redirect(`/company/${companyId}/branches/${firstId}`);
      }
    }
  } catch {
    // ignore and render overview
  }

  let overview: Awaited<ReturnType<typeof Reports.getCompanyReportsOverview>> | null = null;
  try {
    overview = await Reports.getCompanyReportsOverview(companyId);
  } catch {
    overview = null;
  }

  const kpis = overview
    ? [
        { label: "Total Leads", value: overview.totalLeads },
        { label: "Open Leads", value: overview.openLeads },
        { label: "Workshop Jobs", value: overview.totalWorkshopJobs },
        { label: "Calls Today", value: overview.todayCalls },
      ]
    : [];

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Company Overview</h1>
          <p className="text-sm text-muted-foreground">
            High-level summary for this company. Use Operations Dashboard for daily execution.
          </p>
        </div>

        {kpis.length > 0 ? (
          <KpiGrid items={kpis} />
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            Overview metrics are unavailable right now.
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Quick Navigation</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/company/${companyId}/operations-dashboard`}
              className="inline-flex items-center rounded-md border border-white/30 bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Operations Dashboard
            </Link>
            <Link
              href={`/company/${companyId}/car-in-dashboard`}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Car-In Dashboard
            </Link>
            <Link
              href={`/company/${companyId}/reports/overview`}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Reports Overview
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
