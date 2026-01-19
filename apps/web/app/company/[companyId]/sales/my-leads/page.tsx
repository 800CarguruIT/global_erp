"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Lead = {
  id: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  leadStatus?: string | null;
  source?: string | null;
  agentName?: string | null;
  createdAt?: string | null;
};

type Props = { params: { companyId: string } };

type StatusTab =
  | "all"
  | "open"
  | "assigned"
  | "onboarding"
  | "inprocess"
  | "completed"
  | "closed"
  | "lost";

const STATUS_TABS: StatusTab[] = [
  "all",
  "open",
  "assigned",
  "onboarding",
  "inprocess",
  "completed",
  "closed",
  "lost",
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-500/15 text-sky-600",
  assigned: "bg-indigo-500/15 text-indigo-600",
  onboarding: "bg-amber-500/15 text-amber-600",
  inprocess: "bg-orange-500/15 text-orange-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  closed: "bg-emerald-500/15 text-emerald-600",
  lost: "bg-rose-500/15 text-rose-600",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "-" : dateFormatter.format(parsed);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

function safeText(value: string | null | undefined) {
  return value && value !== "null" ? value : "-";
}

function formatStatusLabel(value: string) {
  if (value === "all") return "All";
  if (value === "inprocess") return "In Process";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatusBadge({ status }: { status?: string | null }) {
  const key = normalize(status);
  const style = STATUS_STYLES[key] ?? "bg-slate-500/15 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${style}`}>
      {status ? status : "-"}
    </span>
  );
}

export default function CompanyMyLeadsPage({ params }: Props) {
  const { companyId } = params;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    let rows = leads;

    if (statusFilter !== "all") {
      rows = rows.filter((l) => normalize(l.leadStatus) === statusFilter);
    }

    if (!term) return rows;

    return rows.filter((l) => {
      const haystack = [
        l.customerName,
        l.customerPhone,
        l.customerEmail,
        l.leadStatus,
        l.source,
        l.agentName,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [leads, query, statusFilter]);

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
  }

  return (
    <AppLayout>
      <div className="w-full -mx-4 px-4 lg:-mx-8 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold">Sales Leads</h1>
            <p className="text-sm text-muted-foreground">Manage sales leads for this company.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              View All
            </button>
            <Link
              href={`/company/${companyId}/sales/my-leads/new`}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Add Lead
            </Link>
          </div>
        </div>

        <Card className="rounded-2xl border-x border-border/30 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
            <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
              {STATUS_TABS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatusFilter(val)}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${
                    statusFilter === val
                      ? "bg-background text-foreground shadow-sm border border-border/40"
                      : "border border-transparent text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {formatStatusLabel(val)}
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-xs">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
          </div>

          {error && <div className="px-4 pt-3 text-xs text-red-500">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-left bg-muted/20">
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Lead
                  </th>
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Contact
                  </th>
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Source
                  </th>
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Owner
                  </th>
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground text-center" colSpan={7}>
                      Loading leads...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td className="px-3 py-6 text-red-500 text-center" colSpan={7}>
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground text-center" colSpan={7}>
                      No leads found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  filtered.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 border-b border-border/30">
                        <div className="font-medium text-foreground">{
                          lead.customerName && lead.customerName !== "null" ? lead.customerName : "Lead"
                        }</div>
                        <div className="text-xs text-muted-foreground">{safeText(lead.customerEmail)}</div>
                      </td>
                      <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                        {safeText(lead.customerPhone)}
                      </td>
                      <td className="px-4 py-3 border-b border-border/30">
                        {safeText(lead.source)}
                      </td>
                      <td className="px-4 py-3 border-b border-border/30">
                        {safeText(lead.agentName)}
                      </td>
                      <td className="px-4 py-3 border-b border-border/30">
                        <StatusBadge status={lead.leadStatus} />
                      </td>
                      <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-border/30">
                        <Link
                          href={`/company/${companyId}/sales/my-leads/${lead.id}`}
                          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                        >
                          <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                            <path
                              d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
