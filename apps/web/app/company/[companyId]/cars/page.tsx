"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppLayout, useTheme } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };
type CarListItem = {
  id: string;
  code?: string | null;
  plate_number?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  is_active?: boolean | null;
};

function toErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function CompanyCarsPage({ params }: Params) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cars, setCars] = useState<CarListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<"10" | "25" | "50" | "100" | "all">("50");
  const [sortBy, setSortBy] = useState<"created_at" | "plate_number" | "vin" | "make" | "model_year" | "code">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"active" | "archived">("active");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ id: string; nextActive: boolean } | null>(null);
  const [urlHydrated, setUrlHydrated] = useState(false);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(560);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (urlHydrated) return;
    const qView = (searchParams.get("view") ?? "").toLowerCase();
    const qPageSize = (searchParams.get("pageSize") ?? "").toLowerCase();
    const qSortBy = (searchParams.get("sortBy") ?? "").toLowerCase();
    const qSortDir = (searchParams.get("sortDir") ?? "").toLowerCase();
    const qSearch = searchParams.get("search") ?? "";
    const qPage = Number(searchParams.get("page") ?? "1");
    if (qView === "active" || qView === "archived") setView(qView);
    if (qPageSize === "10" || qPageSize === "25" || qPageSize === "50" || qPageSize === "100" || qPageSize === "all") setPageSize(qPageSize);
    if (qSortBy === "created_at" || qSortBy === "plate_number" || qSortBy === "vin" || qSortBy === "make" || qSortBy === "model_year" || qSortBy === "code") setSortBy(qSortBy);
    if (qSortDir === "asc" || qSortDir === "desc") setSortDir(qSortDir);
    if (qSearch) {
      setSearch(qSearch);
      setDebouncedSearch(qSearch);
    }
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
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [urlHydrated, view, page, pageSize, sortBy, sortDir, search, router, pathname]);

  useEffect(() => {
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

  const loadCars = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ companyId, page: String(page), pageSize, status: view, sortBy, sortDir });
      if (debouncedSearch) query.set("search", debouncedSearch);
      const res = await fetch(`/api/cars?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCars(data?.data ?? []);
      setTotal(Number(data?.meta?.total ?? 0));
      setTotalPages(Math.max(1, Number(data?.meta?.totalPages ?? 1)));
      setSelected({});
    } catch (err: unknown) {
      setError(toErrorMessage(err, "Failed to load cars"));
    } finally {
      setLoading(false);
    }
  }, [companyId, page, pageSize, view, sortBy, sortDir, debouncedSearch]);

  useEffect(() => {
    if (!companyId) return;
    loadCars();
  }, [companyId, loadCars]);

  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setTableViewportHeight(node.clientHeight || 560));
    observer.observe(node);
    setTableViewportHeight(node.clientHeight || 560);
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => cars, [cars]);
  const selectedCount = useMemo(() => Object.keys(selected).filter((id) => selected[id]).length, [selected]);
  const visiblePages = useMemo(() => {
    if (totalPages <= 3) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    return [start, start + 1, start + 2];
  }, [page, totalPages]);
  const virtualEnabled = filtered.length > 80;
  const rowHeight = 52;
  const virtualRows = useMemo(() => {
    if (!virtualEnabled) return { rows: filtered, topSpacer: 0, bottomSpacer: 0 };
    const visible = Math.ceil(tableViewportHeight / rowHeight) + 10;
    const start = Math.max(0, Math.floor(tableScrollTop / rowHeight) - 5);
    const end = Math.min(filtered.length, start + visible);
    return { rows: filtered.slice(start, end), topSpacer: start * rowHeight, bottomSpacer: Math.max(0, (filtered.length - end) * rowHeight) };
  }, [filtered, virtualEnabled, tableViewportHeight, tableScrollTop]);

  async function bulkArchive(ids: string[], active: boolean) {
    if (!companyId || !ids.length) return;
    setLoading(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/cars/${id}?companyId=${companyId}`, {
            method: active ? "DELETE" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: active ? undefined : JSON.stringify({ scope: "company", companyId, is_active: true }),
          })
        )
      );
      await loadCars();
    } finally {
      setLoading(false);
    }
  }

  async function confirmToggleStatus() {
    if (!companyId || !statusModal) return;
    const { id, nextActive } = statusModal;
    setStatusUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const res = nextActive
        ? await fetch(`/api/cars/${id}?companyId=${companyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "company", companyId, is_active: true }) })
        : await fetch(`/api/cars/${id}?companyId=${companyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to update status");
      setStatusModal(null);
      await loadCars();
    } catch (err: unknown) {
      setStatusError(toErrorMessage(err, "Failed to update status"));
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  function applyColumnSort(field: "created_at" | "plate_number" | "vin" | "make" | "model_year" | "code") {
    if (sortBy === field) return setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    setSortBy(field);
    setSortDir(field === "created_at" ? "desc" : "asc");
  }
  const sortLabel = (field: "created_at" | "plate_number" | "vin" | "make" | "model_year" | "code") => (sortBy !== field ? "" : sortDir === "asc" ? "ASC" : "DESC");

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold">Cars</h1>
            <p className="text-sm text-muted-foreground">Standalone cars that can be linked to customers later.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setSearch(""); setView("active"); setPage(1); }} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg">View All</button>
            <Link href={companyId ? `/company/${companyId}/cars/new` : "#"} className="inline-flex items-center rounded-md border border-border bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg">Add Car</Link>
          </div>
        </div>

        <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-3`}>
          <div className="space-y-3 rounded-2xl border-0 bg-background shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/30 px-4 py-3">
              <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">{(["active", "archived"] as const).map((val) => <button key={val} type="button" onClick={() => setView(val)} className={`rounded-md px-3 py-1.5 font-medium transition ${view === val ? "bg-background text-foreground shadow-sm border border-border/40" : "border border-transparent text-muted-foreground hover:bg-muted/50"}`}>{val === "active" ? "Active" : "Archived"}</button>)}</div>
              <div className="flex w-full max-w-md flex-wrap items-center gap-2 justify-end">
                <button type="button" onClick={loadCars} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg">Refresh</button>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <select value={pageSize} onChange={(e) => setPageSize(e.target.value as "10" | "25" | "50" | "100" | "all")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="all">All</option></select>
              </div>
            </div>
            {statusError && <div className="px-4 pt-3 text-xs text-red-500">{statusError}</div>}
            {error && <div className="px-4 pt-3 text-xs text-red-500">{error}</div>}
            {selectedCount > 0 && <div className="mx-4 mb-2 flex items-center justify-between rounded-lg border border-slate-300/40 bg-slate-100/60 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">{selectedCount} selected</span><div className="flex gap-2"><button type="button" onClick={() => setSelected({})} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-600">Clear</button><button type="button" disabled={loading} onClick={() => bulkArchive(Object.keys(selected).filter((id) => selected[id]), view === "active")} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-600 disabled:opacity-50">{view === "active" ? "Archive selected" : "Unarchive selected"}</button></div></div>}

            <div ref={tableScrollRef} onScroll={(e) => setTableScrollTop((e.currentTarget as HTMLDivElement).scrollTop)} className="hidden max-h-[62vh] overflow-auto rounded-xl border border-slate-700/50 md:block">
              <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-left bg-background">
                    <th className="px-4 py-3.5 sticky left-0 top-0 z-30 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300 shadow-[inset_-1px_0_0_rgba(148,163,184,0.22)]"><input type="checkbox" checked={filtered.length > 0 && filtered.every((c) => selected[c.id])} onChange={(e) => { const next = { ...selected }; filtered.forEach((c) => { next[c.id] = e.target.checked; }); setSelected(next); }} /></th>
                    <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300"><button type="button" onClick={() => applyColumnSort("plate_number")} className="inline-flex items-center gap-1.5 hover:text-foreground">Plate {sortLabel("plate_number") ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">{sortLabel("plate_number")}</span> : null}</button></th>
                    <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300"><button type="button" onClick={() => applyColumnSort("vin")} className="inline-flex items-center gap-1.5 hover:text-foreground">VIN {sortLabel("vin") ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">{sortLabel("vin")}</span> : null}</button></th>
                    <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300"><button type="button" onClick={() => applyColumnSort("make")} className="inline-flex items-center gap-1.5 hover:text-foreground">Make / Model {sortLabel("make") ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">{sortLabel("make")}</span> : null}</button></th>
                    <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300"><button type="button" onClick={() => applyColumnSort("model_year")} className="inline-flex items-center gap-1.5 hover:text-foreground">Year {sortLabel("model_year") ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">{sortLabel("model_year")}</span> : null}</button></th>
                    <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300"><button type="button" onClick={() => applyColumnSort("code")} className="inline-flex items-center gap-1.5 hover:text-foreground">Code {sortLabel("code") ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-slate-200">{sortLabel("code")}</span> : null}</button></th>
                    <th className="px-4 py-3.5 sticky top-0 z-20 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Status</th>
                    <th className="px-4 py-3.5 text-right sticky right-0 top-0 z-30 bg-background border-b border-slate-700/60 text-[11px] font-semibold uppercase tracking-wide text-slate-300 shadow-[inset_1px_0_0_rgba(148,163,184,0.22)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td className="px-3 py-6 text-muted-foreground text-center" colSpan={8}>Loading cars...</td></tr> : filtered.length === 0 ? <tr><td className="px-3 py-6 text-muted-foreground text-center" colSpan={8}>No cars found.</td></tr> : <>
                    {virtualRows.topSpacer > 0 ? <tr><td className="p-0 border-0" colSpan={8} style={{ height: `${virtualRows.topSpacer}px` }} /></tr> : null}
                    {virtualRows.rows.map((c) => (
                      <tr key={c.id} className="transition-colors odd:bg-transparent even:bg-slate-900/25 hover:bg-slate-800/35">
                        <td className="px-4 py-3.5 border-b border-slate-300/25 sticky left-0 z-10 bg-background shadow-[inset_-1px_0_0_rgba(148,163,184,0.18)]"><input type="checkbox" checked={!!selected[c.id]} onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))} /></td>
                        <td className="px-4 py-3.5 border-b border-slate-300/25"><Link href={companyId ? `/company/${companyId}/cars/${c.id}` : "#"} className="text-primary hover:underline">{c.plate_number || "-"}</Link></td>
                        <td className="px-4 py-3.5 border-b border-slate-300/25">{c.vin || "-"}</td>
                        <td className="px-4 py-3.5 border-b border-slate-300/25">{[c.make, c.model].filter(Boolean).join(" ") || "-"}</td>
                        <td className="px-4 py-3.5 border-b border-slate-300/25">{c.model_year ?? "-"}</td>
                        <td className="px-4 py-3.5 border-b border-slate-300/25 text-muted-foreground">{c.code || "-"}</td>
                        <td className="px-4 py-3.5 border-b border-slate-300/25"><div className="flex items-center gap-2"><span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${c.is_active === false ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}>{c.is_active === false ? "Inactive" : "Active"}</span><button type="button" role="switch" aria-checked={c.is_active !== false} aria-busy={statusUpdating[c.id] ?? false} disabled={statusUpdating[c.id] ?? false} onClick={() => setStatusModal({ id: c.id, nextActive: c.is_active === false })} className={`relative inline-flex h-5 w-9 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${c.is_active === false ? "border-border/40 bg-muted/40" : "border-emerald-400 bg-emerald-500/30"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${c.is_active === false ? "translate-x-1" : "translate-x-4"}`} /></button></div></td>
                        <td className="px-4 py-3.5 text-right border-b border-slate-300/25 sticky right-0 z-10 bg-background shadow-[inset_1px_0_0_rgba(148,163,184,0.18)]"><div className="flex items-center justify-end gap-2 whitespace-nowrap"><Link href={companyId ? `/company/${companyId}/cars/${c.id}/edit` : "#"} className="inline-flex items-center rounded-md border border-border bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md">Edit</Link><Link href={companyId ? `/company/${companyId}/cars/${c.id}` : "#"} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md">View</Link></div></td>
                      </tr>
                    ))}
                    {virtualRows.bottomSpacer > 0 ? <tr><td className="p-0 border-0" colSpan={8} style={{ height: `${virtualRows.bottomSpacer}px` }} /></tr> : null}
                  </>}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
              <span>Page {page} of {totalPages} (Total: {total})</span>
              <div className="flex gap-2">
                <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                {visiblePages.map((p) => <button key={p} type="button" className={`rounded-md border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${p === page ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"}`} disabled={loading} onClick={() => setPage(p)}>{p}</button>)}
                <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          </div>
        </div>

        {statusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
              <div className="text-lg font-semibold text-slate-100">{statusModal.nextActive ? "Unarchive car?" : "Archive car?"}</div>
              <p className="mt-1 text-sm text-slate-300">{statusModal.nextActive ? "This car will become active again and visible in active lists." : "This car will be archived and can be reactivated later."}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setStatusModal(null)} className="rounded-md border border-slate-500 bg-slate-100 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white">Cancel</button>
                <button type="button" onClick={confirmToggleStatus} disabled={statusUpdating[statusModal.id] ?? false} className={`rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60 ${statusModal.nextActive ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}>{statusUpdating[statusModal.id] ? "Updating..." : statusModal.nextActive ? "Unarchive" : "Archive"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
