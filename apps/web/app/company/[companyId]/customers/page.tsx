"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";

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

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/customers?companyId=${companyId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => setCustomers(data?.data ?? data ?? []))
      .catch((err: any) => setError(err?.message ?? "Failed to load customers"))
      .finally(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = view === "active" ? customers.filter((c: any) => c.is_active !== false) : customers.filter((c: any) => c.is_active === false);
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
      const res = await fetch(`/api/customers?companyId=${companyId}`);
      const data = await res.json().catch(() => ({}));
      setCustomers(data?.data ?? data ?? []);
      setSelected({});
    } catch (err: any) {
      setError(err?.message ?? "Bulk update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Customers</h1>
            <p className="text-sm text-muted-foreground">List, create, and manage customers.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers/new` : "#"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
          >
            New Customer
          </Link>
        </div>

        <Card className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-lg font-semibold">Customer List</div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="flex items-center gap-2 text-sm">
                <button
                  className={`rounded-md border px-3 py-1 ${view === "active" ? "border-primary text-primary" : ""}`}
                  onClick={() => setView("active")}
                >
                  Active
                </button>
                <button
                  className={`rounded-md border px-3 py-1 ${view === "archived" ? "border-primary text-primary" : ""}`}
                  onClick={() => setView("archived")}
                >
                  Archived
                </button>
              </div>
              <input
                className={`${theme.input} md:w-72`}
                placeholder="Search by name, phone, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex gap-2">
                {view === "active" ? (
                  <button
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50 hover:bg-muted"
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
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50 hover:bg-muted"
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
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="overflow-auto rounded-md border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">
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
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Phone</th>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Cars</th>
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      Loading customers...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      No customers found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[c.id]}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={companyId ? `/company/${companyId}/customers/${c.id}` : "#"}
                          className="text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{c.phone || "-"}</td>
                      <td className="px-3 py-2">{c.email || "-"}</td>
                      <td className="px-3 py-2">{c.carCount ?? c.carcount ?? 0}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.code || "-"}</td>
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
