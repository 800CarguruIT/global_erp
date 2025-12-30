"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type CarListItem = {
  id: string;
  code?: string | null;
  plate_number?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
};

export default function CompanyCarsPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cars, setCars] = useState<CarListItem[]>([]);
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
    fetch(`/api/cars?companyId=${companyId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => setCars(data?.data ?? data ?? []))
      .catch((err: any) => setError(err?.message ?? "Failed to load cars"))
      .finally(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = view === "active" ? cars.filter((c: any) => c.is_active !== false) : cars.filter((c: any) => c.is_active === false);
    if (!term) return filtered;
    return filtered.filter((c) => {
      return (
        (c.plate_number ?? "").toLowerCase().includes(term) ||
        (c.vin ?? "").toLowerCase().includes(term) ||
        (c.make ?? "").toLowerCase().includes(term) ||
        (c.model ?? "").toLowerCase().includes(term) ||
        (c.code ?? "").toLowerCase().includes(term)
      );
    });
  }, [cars, search, view]);

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
      const res = await fetch(`/api/cars?companyId=${companyId}`);
      const data = await res.json().catch(() => ({}));
      setCars(data?.data ?? data ?? []);
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
            <h1 className="text-2xl font-semibold">Cars</h1>
            <p className="text-sm text-muted-foreground">Standalone cars that can be linked to customers later.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/cars/new` : "#"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
          >
            New Car
          </Link>
        </div>

        <Card className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-lg font-semibold">Car List</div>
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
                placeholder="Search plate, VIN, make, or model"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex gap-2">
                {view === "active" ? (
                  <button
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
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
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
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
                  <th className="px-3 py-2 text-left font-semibold">Plate</th>
                  <th className="px-3 py-2 text-left font-semibold">VIN</th>
                  <th className="px-3 py-2 text-left font-semibold">Make / Model</th>
                  <th className="px-3 py-2 text-left font-semibold">Year</th>
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      Loading cars...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      No cars found.
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
                          href={companyId ? `/company/${companyId}/cars/${c.id}` : "#"}
                          className="text-primary hover:underline"
                        >
                          {c.plate_number || "-"}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{c.vin || "-"}</td>
                      <td className="px-3 py-2">
                        {[c.make, c.model].filter(Boolean).join(" ") || "-"}
                      </td>
                      <td className="px-3 py-2">{c.model_year ?? "-"}</td>
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
