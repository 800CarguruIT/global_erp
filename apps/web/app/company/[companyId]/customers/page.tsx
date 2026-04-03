"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppLayout, useTheme } from "@repo/ui";
import { AIPanel } from "../../../(components)/intelligence/AIPanel";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type CustomerListItem = {
  id: string;
  name: string;
  is_active?: boolean;
  email?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  code?: string | null;
  carcount?: number;
  carCount?: number;
};

function toErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function CompanyCustomersPage({ params }: Params) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<"10" | "25" | "50" | "100" | "all">("50");
  const [sortBy, setSortBy] = useState<"created_at" | "name" | "code" | "phone" | "email">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [urlHydrated, setUrlHydrated] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<{ all: number; active: number; archived: number }>({
    all: 0,
    active: 0,
    archived: 0,
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"active" | "archived">("active");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState<null | "excel" | "pdf">(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(560);
  const didInitSearchRef = useRef(false);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (urlHydrated && !didInitSearchRef.current) {
      didInitSearchRef.current = true;
      setDebouncedSearch(search.trim());
      return;
    }
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      if (urlHydrated) setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search, urlHydrated]);

  useEffect(() => {
    if (!urlHydrated) return;
    setPage(1);
  }, [view, pageSize, sortBy, sortDir, urlHydrated]);

  useEffect(() => {
    if (urlHydrated) return;
    const qView = (searchParams.get("view") ?? "").toLowerCase();
    const qPageSize = (searchParams.get("pageSize") ?? "").toLowerCase();
    const qSortBy = (searchParams.get("sortBy") ?? "").toLowerCase();
    const qSortDir = (searchParams.get("sortDir") ?? "").toLowerCase();
    const qSearch = searchParams.get("search") ?? "";
    const qPage = Number(searchParams.get("page") ?? "1");

    if (qView === "active" || qView === "archived") setView(qView);
    if (qPageSize === "10" || qPageSize === "25" || qPageSize === "50" || qPageSize === "100" || qPageSize === "all") {
      setPageSize(qPageSize);
    }
    if (qSortBy === "created_at" || qSortBy === "name" || qSortBy === "code" || qSortBy === "phone" || qSortBy === "email") {
      setSortBy(qSortBy);
    }
    if (qSortDir === "asc" || qSortDir === "desc") setSortDir(qSortDir);
    if (qSearch) setSearch(qSearch);
    if (Number.isFinite(qPage) && qPage > 0) setPage(Math.floor(qPage));
    setUrlHydrated(true);
  }, [searchParams, urlHydrated]);

  useEffect(() => {
    if (!urlHydrated) return;
    const q = new URLSearchParams();
    q.set("view", view);
    q.set("page", String(page));
    q.set("pageSize", pageSize);
    q.set("sortBy", sortBy);
    q.set("sortDir", sortDir);
    if (search.trim()) q.set("search", search.trim());
    else q.delete("search");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [urlHydrated, view, page, pageSize, sortBy, sortDir, search, router, pathname]);

  const loadCustomers = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        companyId,
        page: String(page),
        pageSize,
        status: view,
        sortBy,
        sortDir,
      });
      if (debouncedSearch) query.set("search", debouncedSearch);
      const res = await fetch(`/api/customers?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCustomers(data?.data ?? data ?? []);
      setTotal(Number(data?.meta?.total ?? (data?.data?.length ?? 0)));
      setTotalPages(Math.max(1, Number(data?.meta?.totalPages ?? 1)));
      setCounts({
        all: Number(data?.meta?.counts?.all ?? 0),
        active: Number(data?.meta?.counts?.active ?? 0),
        archived: Number(data?.meta?.counts?.archived ?? 0),
      });
      setSelected({});
    } catch (err: unknown) {
      setError(toErrorMessage(err, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  }, [companyId, page, pageSize, view, debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    if (!companyId) return;
    loadCustomers();
  }, [companyId, loadCustomers]);

  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setTableViewportHeight(node.clientHeight || 560);
    });
    observer.observe(node);
    setTableViewportHeight(node.clientHeight || 560);
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => customers, [customers]);
  const selectedCount = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]).length,
    [selected]
  );
  const virtualEnabled = filtered.length > 80;
  const rowHeight = 49;
  const virtualRows = useMemo(() => {
    if (!virtualEnabled) {
      return { rows: filtered, start: 0, topSpacer: 0, bottomSpacer: 0 };
    }
    const visible = Math.ceil(tableViewportHeight / rowHeight) + 10;
    const start = Math.max(0, Math.floor(tableScrollTop / rowHeight) - 5);
    const end = Math.min(filtered.length, start + visible);
    const topSpacer = start * rowHeight;
    const bottomSpacer = Math.max(0, (filtered.length - end) * rowHeight);
    return { rows: filtered.slice(start, end), start, topSpacer, bottomSpacer };
  }, [filtered, virtualEnabled, tableViewportHeight, tableScrollTop]);
  const visiblePages = useMemo(() => {
    if (totalPages <= 3) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    return [start, start + 1, start + 2];
  }, [page, totalPages]);

  async function bulkArchive(ids: string[], active: boolean) {
    if (!companyId || !ids.length) return;
    setLoading(true);
    setStatusError(null);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/customers/${id}?companyId=${companyId}`, {
            method: active ? "DELETE" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: active ? undefined : JSON.stringify({ scope: "company", companyId, is_active: true }),
          })
        )
      );
      // refresh
      await loadCustomers();
      setSelected({});
    } catch (err: unknown) {
      setError(toErrorMessage(err, "Bulk update failed"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, nextActive: boolean) {
    if (!companyId) return;
    setStatusError(null);
    setStatusUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const res = nextActive
        ? await fetch(`/api/customers/${id}?companyId=${companyId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scope: "company", companyId, is_active: true }),
          })
        : await fetch(`/api/customers/${id}?companyId=${companyId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update status");
      }
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: nextActive } : c)));
      await loadCustomers();
    } catch (err: unknown) {
      setStatusError(toErrorMessage(err, "Failed to update status"));
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function exportCustomers(format: "excel" | "pdf") {
    if (!companyId) return;
    setExporting(format);
    setStatusError(null);
    try {
      const query = new URLSearchParams({
        companyId,
        status: view,
        format,
      });
      if (debouncedSearch) query.set("search", debouncedSearch);
      const res = await fetch(`/api/customers/export?${query.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const ext = format === "pdf" ? "pdf" : "xls";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `customers-${view}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err: unknown) {
      setStatusError(toErrorMessage(err, "Failed to export customers"));
    } finally {
      setExporting(null);
    }
  }

  function applyColumnSort(field: "created_at" | "name" | "code" | "phone" | "email") {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortDir(field === "created_at" ? "desc" : "asc");
  }

  function sortLabel(field: "created_at" | "name" | "code" | "phone" | "email") {
    if (sortBy !== field) return "";
    return sortDir === "asc" ? "ASC" : "DESC";
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <AIPanel companyId={companyId} engines={["e4", "e6"]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold">Customers</h1>
            <p className="text-sm text-muted-foreground">List, create, and manage customers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setView("active");
                setPage(1);
              }}
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
              href={companyId ? `/company/${companyId}/customers/new` : "#"}
              className="inline-flex items-center rounded-md border border-border bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
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
              Add Customer
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-300/30 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Customers</p>
            <p className="mt-2 text-2xl font-semibold">{counts.all.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Active</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{counts.active.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Archived</p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{counts.archived.toLocaleString()}</p>
          </div>
        </div>

        <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-3`}>
          <div className="space-y-3">
            <div className="rounded-2xl border-0 bg-background shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/30 px-4 py-3">
                <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
                  {(["active", "archived"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setView(val)}
                      className={`rounded-md px-3 py-1.5 font-medium transition ${
                        view === val
                          ? "bg-background text-foreground shadow-sm border border-border/40"
                          : "border border-transparent text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {val === "active" ? "Active" : "Archived"}
                    </button>
                  ))}
                </div>
                <div className="flex w-full max-w-md flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => exportCustomers("excel")}
                    disabled={exporting !== null}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg disabled:opacity-60"
                  >
                    {exporting === "excel" ? "Exporting..." : "Export Excel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCustomers("pdf")}
                    disabled={exporting !== null}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg disabled:opacity-60"
                  >
                    {exporting === "pdf" ? "Exporting..." : "Export PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={loadCustomers}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
                  >
                    <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                      <path
                        d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M4 4v5h5M20 20v-5h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Refresh
                  </button>
                  <div className="relative w-full max-w-xs">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
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
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as "10" | "25" | "50" | "100" | "all")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              {statusError && <div className="px-4 pt-3 text-xs text-red-500">{statusError}</div>}
              {error && <div className="px-4 pt-3 text-xs text-red-500">{error}</div>}
              {selectedCount > 0 && (
                <div className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300/40 bg-slate-100/60 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">{selectedCount} selected</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected({})}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-600"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => bulkArchive(Object.keys(selected).filter((id) => selected[id]), view === "active")}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-600 disabled:opacity-50"
                    >
                      {view === "active" ? "Archive selected" : "Unarchive selected"}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-3 px-3 pb-3 pt-2 md:hidden">
                {loading ? (
                  <div className="rounded-xl border border-slate-300/30 bg-muted/10 px-3 py-4 text-center text-sm text-muted-foreground">
                    Loading customers...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-xl border border-slate-300/30 bg-muted/10 px-3 py-4 text-center text-sm text-muted-foreground">
                    No customers found.
                  </div>
                ) : (
                  filtered.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-300/30 bg-background/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <label className="inline-flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!selected[c.id]}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                            className="mt-1"
                          />
                          <Link
                            href={companyId ? `/company/${companyId}/customers/${c.id}` : "#"}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            {c.name}
                          </Link>
                        </label>
                        <button
                          type="button"
                          onClick={() => setMobileExpanded((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                        >
                          {mobileExpanded[c.id] ? "Hide data" : "Show data"}
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                            c.is_active === false
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-emerald-500/15 text-emerald-600"
                          }`}
                        >
                          {c.is_active === false ? "Inactive" : "Active"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.is_active !== false}
                          aria-busy={statusUpdating[c.id] ?? false}
                          disabled={statusUpdating[c.id] ?? false}
                          onClick={() => toggleStatus(c.id, c.is_active === false)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            c.is_active === false
                              ? "border-border/40 bg-muted/40"
                              : "border-emerald-400 bg-emerald-500/30"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              c.is_active === false ? "translate-x-1" : "translate-x-4"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={companyId ? `/company/${companyId}/customers/${c.id}` : "#"}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                        >
                          View
                        </Link>
                        <Link
                          href={companyId ? `/company/${companyId}/customers/${c.id}/edit` : "#"}
                          className="inline-flex items-center rounded-md border border-border bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                        >
                          Edit
                        </Link>
                      </div>

                      {mobileExpanded[c.id] ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-slate-300/30 bg-muted/10 p-3 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Phone</span>
                            <span className="font-medium">{c.phone || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Email</span>
                            <span className="max-w-[55vw] truncate font-medium">{c.email || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Cars</span>
                            <span className="font-medium">{c.carCount ?? c.carcount ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Code</span>
                            <span className="font-medium">{c.code || "-"}</span>
                          </div>
                          <button
                            type="button"
                            className={`mt-1 text-xs font-semibold ${
                              c.is_active === false ? "text-emerald-600" : "text-red-500"
                            }`}
                            disabled={statusUpdating[c.id] ?? false}
                            onClick={() => toggleStatus(c.id, c.is_active === false)}
                          >
                            {c.is_active === false ? "Unarchive" : "Archive"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div
                ref={tableScrollRef}
                onScroll={(e) => setTableScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
                className="hidden max-h-[62vh] overflow-auto rounded-xl border border-slate-700/50 md:block"
              >
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-background">
                      <th className="px-4 py-3.5 sticky left-0 top-0 z-30 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300 shadow-[inset_-1px_0_0_rgba(148,163,184,0.22)]">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every((c) => selected[c.id])}
                          onChange={(e) => {
                            const next = { ...selected };
                            filtered.forEach((c) => {
                              next[c.id] = e.target.checked;
                            });
                            setSelected(next);
                          }}
                        />
                      </th>
                      <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        <button
                          type="button"
                          onClick={() => applyColumnSort("name")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          Name
                          {sortLabel("name") ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">
                              {sortLabel("name")}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        <button
                          type="button"
                          onClick={() => applyColumnSort("phone")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          Phone
                          {sortLabel("phone") ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">
                              {sortLabel("phone")}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        <button
                          type="button"
                          onClick={() => applyColumnSort("email")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          Email
                          {sortLabel("email") ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">
                              {sortLabel("email")}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        Cars
                      </th>
                      <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        <button
                          type="button"
                          onClick={() => applyColumnSort("code")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          Code
                          {sortLabel("code") ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">
                              {sortLabel("code")}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-right sticky right-0 top-0 z-30 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300 shadow-[inset_1px_0_0_rgba(148,163,184,0.22)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-3 py-6 text-muted-foreground text-center" colSpan={8}>
                          Loading customers...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-muted-foreground text-center" colSpan={8}>
                          No customers found.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {virtualRows.topSpacer > 0 ? (
                          <tr>
                            <td className="p-0 border-0" colSpan={8} style={{ height: `${virtualRows.topSpacer}px` }} />
                          </tr>
                        ) : null}
                      {virtualRows.rows.map((c) => (
                        <tr key={c.id} className="transition-colors odd:bg-transparent even:bg-popover/25 hover:bg-muted/35">
                          <td className="px-4 py-3.5 border-b border-slate-300/25 sticky left-0 z-10 bg-background shadow-[inset_-1px_0_0_rgba(148,163,184,0.18)]">
                            <input
                              type="checkbox"
                              checked={!!selected[c.id]}
                              onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-4 py-3.5 border-b border-slate-300/25">
                            <Link
                              href={companyId ? `/company/${companyId}/customers/${c.id}` : "#"}
                              className="text-primary hover:underline"
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 border-b border-slate-300/25">{c.phone || "-"}</td>
                          <td className="px-4 py-3.5 border-b border-slate-300/25">{c.email || "-"}</td>
                          <td className="px-4 py-3.5 border-b border-slate-300/25">{c.carCount ?? c.carcount ?? 0}</td>
                          <td className="px-4 py-3.5 border-b border-slate-300/25 text-muted-foreground">{c.code || "-"}</td>
                          <td className="px-4 py-3.5 border-b border-slate-300/25 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                                  c.is_active === false
                                    ? "bg-amber-500/15 text-amber-600"
                                    : "bg-emerald-500/15 text-emerald-600"
                                }`}
                              >
                                {c.is_active === false ? "Inactive" : "Active"}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={c.is_active !== false}
                                aria-busy={statusUpdating[c.id] ?? false}
                                disabled={statusUpdating[c.id] ?? false}
                                onClick={() => toggleStatus(c.id, c.is_active === false)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  c.is_active === false
                                    ? "border-border/40 bg-muted/40"
                                    : "border-emerald-400 bg-emerald-500/30"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                    c.is_active === false ? "translate-x-1" : "translate-x-4"
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right border-b border-slate-300/25 sticky right-0 z-10 bg-background shadow-[inset_1px_0_0_rgba(148,163,184,0.18)]">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <Link
                                href={companyId ? `/company/${companyId}/customers/${c.id}/edit` : "#"}
                                className="inline-flex items-center rounded-md border border-border bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                              >
                                Edit
                              </Link>
                              <Link
                                href={companyId ? `/company/${companyId}/customers/${c.id}` : "#"}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                              >
                                View
                              </Link>
                              <button
                                type="button"
                                className={`hover:underline disabled:opacity-60 disabled:cursor-not-allowed text-xs ${
                                  c.is_active === false ? "text-emerald-600" : "text-red-500"
                                }`}
                                disabled={statusUpdating[c.id] ?? false}
                                onClick={() => toggleStatus(c.id, c.is_active === false)}
                              >
                                {c.is_active === false ? "Unarchive" : "Archive"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                        {virtualRows.bottomSpacer > 0 ? (
                          <tr>
                            <td className="p-0 border-0" colSpan={8} style={{ height: `${virtualRows.bottomSpacer}px` }} />
                          </tr>
                        ) : null}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
                <span>
                  Page {page} of {totalPages} (Total: {total})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  {visiblePages.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`rounded-md border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        p === page
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                      }`}
                      disabled={loading}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
