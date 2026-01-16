"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, useTheme } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type CustomerListItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  code?: string | null;
  carcount?: number;
  carCount?: number;
};

export default function CompanyCustomersPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"active" | "archived">("active");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  async function loadCustomers() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers?companyId=${companyId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCustomers(data?.data ?? data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    loadCustomers();
  }, [companyId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered =
      view === "active"
        ? customers.filter((c: any) => c.is_active !== false)
        : customers.filter((c: any) => c.is_active === false);
    if (!term) return filtered;
    return filtered.filter((c) => {
      return (
        (c.name ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term) ||
        (c.code ?? "").toLowerCase().includes(term)
      );
    });
  }, [customers, search, view]);

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
    } catch (err: any) {
      setError(err?.message ?? "Bulk update failed");
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
      setCustomers((prev) =>
        prev.map((c: any) => (c.id === id ? { ...c, is_active: nextActive } : c))
      );
    } catch (err: any) {
      setStatusError(err?.message ?? "Failed to update status");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
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
              className="inline-flex items-center rounded-md border border-white/30 bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
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

        <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-3`}>
          <div className="space-y-3">
            <div className="rounded-2xl border-0 bg-background shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
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
                  {view === "active" ? (
                    <button
                      className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg disabled:opacity-50"
                      disabled={Object.keys(selected).filter((id) => selected[id]).length === 0}
                      onClick={() =>
                        bulkArchive(
                          Object.keys(selected).filter((id) => selected[id]),
                          true
                        )
                      }
                    >
                      Archive selected
                    </button>
                  ) : (
                    <button
                      className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg disabled:opacity-50"
                      disabled={Object.keys(selected).filter((id) => selected[id]).length === 0}
                      onClick={() =>
                        bulkArchive(
                          Object.keys(selected).filter((id) => selected[id]),
                          false
                        )
                      }
                    >
                      Unarchive selected
                    </button>
                  )}
                </div>
              </div>
              {statusError && <div className="px-4 pt-3 text-xs text-red-500">{statusError}</div>}
              {error && <div className="px-4 pt-3 text-xs text-red-500">{error}</div>}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
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
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                        Phone
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                        Email
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                        Cars
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                        Code
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
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
                      filtered.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 border-b border-border/30">
                            <input
                              type="checkbox"
                              checked={!!selected[c.id]}
                              onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <Link
                              href={companyId ? `/company/${companyId}/customers/${c.id}` : "#"}
                              className="text-primary hover:underline"
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 border-b border-border/30">{c.phone || "-"}</td>
                          <td className="px-4 py-3 border-b border-border/30">{c.email || "-"}</td>
                          <td className="px-4 py-3 border-b border-border/30">{c.carCount ?? c.carcount ?? 0}</td>
                          <td className="px-4 py-3 border-b border-border/30 text-muted-foreground">{c.code || "-"}</td>
                          <td className="px-4 py-3 border-b border-border/30">
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
                          <td className="px-4 py-3 text-right border-b border-border/30">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={companyId ? `/company/${companyId}/customers/${c.id}/edit` : "#"}
                                className="inline-flex items-center rounded-md border border-white/30 bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span>Page 1 of 1</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled
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
