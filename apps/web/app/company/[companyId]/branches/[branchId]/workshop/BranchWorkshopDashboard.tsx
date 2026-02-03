"use client";

import { useEffect, useMemo, useState } from "react";

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

export function BranchWorkshopDashboard({
  companyId,
  branchId,
}: {
  companyId: string;
  branchId?: string;
}) {
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
        const rows = (json.data ?? []) as any[];
        const normalized: JobCardRow[] = rows.map((row) => ({
          id: row.id,
          make: row.make ?? null,
          model: row.model ?? null,
          status: row.status ?? null,
          createdAt: row.created_at ?? row.createdAt ?? null,
          estimateId: row.estimate_id ?? row.estimateId ?? null,
        }));
        if (!cancelled) {
          setJobCards(normalized);
        }
      } catch (err) {
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
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">Welcome Rock star!</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {WORKSHOP_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-emerald-600 text-white shadow-lg"
                    : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {WORKSHOP_TABS.find((tab) => tab.id === activeTab)?.description}
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-emerald-500 bg-gradient-to-b from-emerald-600/95 to-emerald-500/90 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/40 px-6 py-4 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-wide">Working Job Cards</h2>
            {branchId && (
              <span className="text-xs uppercase tracking-[0.2em] text-white/70">Branch {branchId}</span>
            )}
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-white/80">
            {filteredJobCards.length} entries
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/30 px-6 py-3 text-sm text-white">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(event) => setEntriesPerPage(Number(event.target.value))}
              className="rounded border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            >
              {ENTRY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="job-card-search" className="text-xs uppercase tracking-[0.2em] text-white/80">
              Search:
            </label>
            <input
              id="job-card-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search job cards"
              className="w-48 rounded border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white placeholder:text-white/60 focus:border-white focus:bg-white/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto bg-white text-slate-900">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-100 text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="py-3 px-4 text-left">Job ID</th>
                <th className="py-3 px-4 text-left">Make</th>
                <th className="py-3 px-4 text-left">Job Card</th>
                <th className="py-3 px-4 text-left">Job Status</th>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                    Loading job cards…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-destructive">
                    {error}
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                    No job cards found for the current filters.
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-3 px-4 font-semibold text-slate-900">{row.id}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{getCarLabel(row) || "-"}</td>
                    <td className="py-3 px-4">
                      <a
                        href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                        className="inline-flex items-center rounded bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-600"
                      >
                        View Jobcard
                      </a>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 uppercase tracking-[0.1em]">
                      {row.status ?? "Pending"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        className="inline-flex items-center rounded bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 shadow-sm transition hover:bg-slate-50"
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            <span>
              Showing {startEntry} to {endEntry} of {filteredJobCards.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!canPrevious}
                className={[
                  "rounded border border-white/40 px-3 py-1 text-xs font-semibold transition",
                  canPrevious ? "bg-white/20 text-white hover:bg-white/30" : "cursor-not-allowed bg-white/10 text-white/40",
                ].join(" ")}
              >
                Previous
              </button>
              <span className="px-2 text-sm font-bold text-white">{currentPage}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!canNext}
                className={[
                  "rounded border border-white/40 px-3 py-1 text-xs font-semibold transition",
                  canNext ? "bg-white/20 text-white hover:bg-white/30" : "cursor-not-allowed bg-white/10 text-white/40",
                ].join(" ")}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
