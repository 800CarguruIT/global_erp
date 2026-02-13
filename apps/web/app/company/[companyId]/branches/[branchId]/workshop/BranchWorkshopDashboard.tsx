"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@repo/ui";

const WORKSHOP_TABS = [
  { id: "inquiries", label: "New Inquiries", description: "Track the latest customer inquiries." },
  { id: "quotes", label: "My Quotes", description: "Jobs that are awaiting quote approval." },
  { id: "inspections", label: "My Inspections", description: "Vehicles that need inspection or check-in." },
  { id: "jobs", label: "My Jobs", description: "Cars that are active inside the workshop." },
  { id: "completed", label: "Completed Orders", description: "Jobs that have already been completed." },
  { id: "cancelled", label: "Cancelled Orders", description: "Jobs that were cancelled or dropped." },
] as const;

const ENTRY_OPTIONS = [5, 10, 25, 50];

type JobCardRow = {
  id: string;
  make?: string | null;
  model?: string | null;
  status?: string | null;
  createdAt?: string | null;
  estimateId?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getCarLabel = (row: JobCardRow) => [row.make, row.model].filter(Boolean).join(" ");

const getStatusTone = (status?: string | null) => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("complete") || normalized.includes("done")) {
    return "bg-emerald-500/15 text-emerald-600";
  }
  if (normalized.includes("cancel")) {
    return "bg-red-500/15 text-red-600";
  }
  if (normalized.includes("progress") || normalized.includes("start")) {
    return "bg-cyan-500/15 text-cyan-600";
  }
  return "bg-amber-500/15 text-amber-600";
};

export function BranchWorkshopDashboard({
  companyId,
  branchId,
}: {
  companyId: string;
  branchId?: string;
}) {
  const { theme } = useTheme();
  const [jobCards, setJobCards] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(WORKSHOP_TABS[0].id);
  const [search, setSearch] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/job-cards`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows = (json.data ?? []) as Array<Record<string, unknown>>;
        const normalized: JobCardRow[] = rows.map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          make: typeof row.make === "string" ? row.make : null,
          model: typeof row.model === "string" ? row.model : null,
          status: typeof row.status === "string" ? row.status : null,
          createdAt:
            typeof row.created_at === "string"
              ? row.created_at
              : typeof row.createdAt === "string"
              ? row.createdAt
              : null,
          estimateId:
            typeof row.estimate_id === "string"
              ? row.estimate_id
              : typeof row.estimateId === "string"
              ? row.estimateId
              : null,
        }));
        if (!cancelled) {
          setJobCards(normalized.filter((row) => row.id));
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load job cards.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [companyId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [entriesPerPage, search, activeTab, jobCards.length]);

  const filteredJobCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobCards.filter((card) => {
      if (!query) return true;
      const haystack = [card.id, card.make, card.model, card.status, card.estimateId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [jobCards, search]);

  const totalPages = Math.max(1, Math.ceil(filteredJobCards.length / entriesPerPage));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * entriesPerPage;
  const displayRows = filteredJobCards.slice(startIndex, startIndex + entriesPerPage);
  const startEntry = filteredJobCards.length === 0 ? 0 : startIndex + 1;
  const endEntry = Math.min(filteredJobCards.length, startIndex + displayRows.length);
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Workshop</h1>
          <p className="text-sm text-muted-foreground">Track branch workshop inquiries, jobs, and job cards.</p>
        </div>
        {branchId && (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
            Branch {branchId}
          </span>
        )}
      </div>

      <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-3`}>
        <div className="space-y-3">
          <div className="rounded-2xl border-0 bg-background shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
              <div className="inline-flex flex-wrap rounded-lg bg-muted/40 p-1 text-xs">
                {WORKSHOP_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-md px-3 py-1.5 font-medium transition ${
                        isActive
                          ? "bg-background text-foreground shadow-sm border border-border/40"
                          : "border border-transparent text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">{filteredJobCards.length} entries</div>
            </div>

            <div className="px-4 pt-3 text-xs text-muted-foreground">
              {WORKSHOP_TABS.find((tab) => tab.id === activeTab)?.description}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Show</span>
                <select
                  value={entriesPerPage}
                  onChange={(event) => setEntriesPerPage(Number(event.target.value))}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm"
                >
                  {ENTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">entries</span>
              </div>

              <div className="relative w-full max-w-xs">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search job cards"
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

            <div className="space-y-3 px-3 pb-3 pt-2 md:hidden">
              {loading ? (
                <div className="rounded-xl border border-border/30 bg-muted/10 px-3 py-4 text-center text-sm text-muted-foreground">
                  Loading job cards...
                </div>
              ) : displayRows.length === 0 ? (
                <div className="rounded-xl border border-border/30 bg-muted/10 px-3 py-4 text-center text-sm text-muted-foreground">
                  No job cards found.
                </div>
              ) : (
                displayRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-border/30 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{row.id}</div>
                        <div className="text-xs text-muted-foreground">{getCarLabel(row) || "-"}</div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(row.status)}`}>
                        {row.status ?? "Pending"}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">{formatDate(row.createdAt)}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                      >
                        View Jobcard
                      </a>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-white/30 bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                      >
                        Add Quote
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-left bg-muted/20">
                    <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                      Job ID
                    </th>
                    <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                      Make
                    </th>
                    <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                      Job Card
                    </th>
                    <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-6 text-muted-foreground text-center" colSpan={6}>
                        Loading job cards...
                      </td>
                    </tr>
                  ) : displayRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-muted-foreground text-center" colSpan={6}>
                        No job cards found.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 border-b border-border/30 font-semibold">{row.id}</td>
                        <td className="px-4 py-3 border-b border-border/30">{getCarLabel(row) || "-"}</td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <a
                            href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                          >
                            View Jobcard
                          </a>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(row.status)}`}>
                            {row.status ?? "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30 text-muted-foreground">{formatDate(row.createdAt)}</td>
                        <td className="px-4 py-3 border-b border-border/30 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-white/30 bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                          >
                            Add Quote
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && !error && (
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span>
                  Showing {startEntry} to {endEntry} of {filteredJobCards.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={!canPrevious}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    Previous
                  </button>
                  <span className="inline-flex items-center px-2 text-sm font-semibold text-foreground">{currentPage}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={!canNext}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
