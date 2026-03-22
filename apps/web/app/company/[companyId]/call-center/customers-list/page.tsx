"use client";

import { AppLayout, useTheme } from "@repo/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = { params: { companyId: string } | Promise<{ companyId: string }> };

type CustomerTab = "chsc" | "non-chsc" | "insurance" | "battery-warranty";
type CustomerRow = {
  id: string;
  code: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  customer_type: string | null;
  created_at: string;
};

const tabs: Array<{ key: CustomerTab; label: string }> = [
  { key: "chsc", label: "CHSC Customers" },
  { key: "non-chsc", label: "Non CHSC Customers" },
  { key: "insurance", label: "Insurance Customers" },
  { key: "battery-warranty", label: "Battery Warranty Customers" },
];

export default function CompanyCallCenterCustomersListPage({ params }: Props) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<CustomerTab>("chsc");
  const [tabCounts, setTabCounts] = useState<Record<CustomerTab, number>>({
    chsc: 0,
    "non-chsc": 0,
    insurance: 0,
    "battery-warranty": 0,
  });
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<"10" | "25" | "50" | "100">("25");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "name">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [jumpPage, setJumpPage] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((p: any) => setCompanyId(String(p?.companyId ?? "").trim()));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function loadCounts() {
      try {
        const res = await fetch(`/api/company/${companyId}/call-center/customers-list?tab=chsc&includeCounts=1`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.counts) {
          setTabCounts({
            chsc: Number(json.counts.chsc ?? 0),
            "non-chsc": Number(json.counts["non-chsc"] ?? 0),
            insurance: Number(json.counts.insurance ?? 0),
            "battery-warranty": Number(json.counts["battery-warranty"] ?? 0),
          });
        }
      } catch {
        // ignore counts fetch errors
      }
    }

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          tab: activeTab,
          page: String(page),
          pageSize,
          sortBy,
          sortDir,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        });
        const res = await fetch(`/api/company/${companyId}/call-center/customers-list?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load customers");
        const json = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(json?.data) ? json.data : []);
        setTotal(Number(json?.meta?.total ?? 0));
        setTotalPages(Math.max(1, Number(json?.meta?.totalPages ?? 1)));
      } catch (err: any) {
        if (!cancelled) {
          setRows([]);
          setError(err?.message ?? "Failed to load customers");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, activeTab, page, pageSize, debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, pageSize, debouncedSearch, sortBy, sortDir]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Call Center Customers List</h1>

        <div className={`rounded-2xl p-2 ${theme.card}`}>
          <div className={`flex gap-2 overflow-x-auto ${theme.surfaceSubtle} rounded-xl p-1`}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`group min-w-max rounded-lg px-4 py-2 text-sm transition ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-background"
                  }`}
                >
                  <span className="mr-2 font-medium whitespace-nowrap">{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tabCounts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${theme.card} ${theme.cardBorder}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{tabs.find((t) => t.key === activeTab)?.label}</div>
            <div className="text-xs text-muted-foreground">Total: {tabCounts[activeTab]}</div>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email, code"
              className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "created_at" | "name")}
                className="rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="created_at">Created Date</option>
                <option value="name">Name</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-800/70"
              >
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
            <div className="flex items-center justify-start gap-2 md:justify-end">
              <span className="text-xs text-muted-foreground">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as "10" | "25" | "50" | "100")}
                className="rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">Page {page} of {totalPages} (Total: {total})</div>
            <div className="text-xs text-muted-foreground">Showing tab: {tabs.find((t) => t.key === activeTab)?.label}</div>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading customers...</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No records found.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-950/30">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left bg-slate-950">
                    <th className="px-4 py-3.5 border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Code</th>
                    <th className="px-4 py-3.5 border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Name</th>
                    <th className="px-4 py-3.5 border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Phone</th>
                    <th className="px-4 py-3.5 border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Email</th>
                    <th className="px-4 py-3.5 border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className={`transition-colors ${idx % 2 ? "bg-slate-900/25" : "bg-transparent"} hover:bg-slate-800/35`}>
                      <td className="px-4 py-3.5 border-b border-slate-300/25 text-slate-100">{row.code ?? "-"}</td>
                      <td className="px-4 py-3.5 border-b border-slate-300/25">
                        <Link href={`/company/${companyId}/customers/${row.id}`} className="font-medium text-primary hover:underline">
                          {row.name ?? "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 border-b border-slate-300/25 text-slate-100">{row.phone ?? "-"}</td>
                      <td className="px-4 py-3.5 border-b border-slate-300/25 text-slate-100">{row.email ?? "-"}</td>
                      <td className="px-4 py-3.5 border-b border-slate-300/25 text-slate-300">{row.customer_type ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  First
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`rounded-md border px-3 py-1 text-xs ${
                      n === page
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-700/60 bg-slate-900/60 text-slate-200 hover:bg-slate-800/70"
                    }`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  Last
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Go to page</span>
                <input
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="1"
                  className="w-16 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                />
                <button
                  type="button"
                  className="rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800/70"
                  onClick={() => {
                    const n = Number(jumpPage || "0");
                    if (!Number.isFinite(n) || n < 1) return;
                    setPage(Math.min(totalPages, n));
                  }}
                >
                  Go
                </button>
              </div>
            </div>
          )}
          {!loading && !error && totalPages <= 1 && (
            <div className="mt-4 text-xs text-muted-foreground">Only one page available.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
