"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import type { InventoryLocation } from "@repo/ai-core/workshop/inventory/types";

const CODE_PREFIX: Record<InventoryLocation["locationType"], string> = {
  warehouse: "WH-M",
  branch: "WH-B",
  fleet_vehicle: "WH-F",
  other: "WH-O",
};

function parseCodeSuffix(code: string | undefined, prefix: string) {
  if (!code) return 0;
  const normalized = code.toUpperCase();
  const marker = `${prefix}-`;
  if (!normalized.startsWith(marker)) return 0;
  const suffix = normalized.slice(marker.length);
  const value = Number.parseInt(suffix, 10);
  return Number.isNaN(value) ? 0 : value;
}

function getPreviewCode(locations: InventoryLocation[], type: InventoryLocation["locationType"]) {
  const prefix = CODE_PREFIX[type] ?? CODE_PREFIX.other;
  const max = locations.reduce((acc, loc) => Math.max(acc, parseCodeSuffix(loc.code, prefix)), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

type Props = { params: Promise<{ companyId: string }> };

type LocationForm = {
  name: string;
  locationType: InventoryLocation["locationType"];
  branchId: string;
};

export default function InventoryLocationsPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(params)
      .then((resolved) => {
        if (!cancelled) setCompanyId(resolved.companyId);
      })
      .catch(() => {
        if (!cancelled) setCompanyId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <InventoryLocationsPanel companyId={companyId} />
    </AppLayout>
  );
}

function InventoryLocationsPanel({ companyId }: { companyId: string }) {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<LocationForm>({
    name: "",
    locationType: "warehouse",
    branchId: "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/locations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setLocations(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError("Unable to load locations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    async function loadBranches() {
      try {
        const res = await fetch(`/api/company/${companyId}/branches`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setBranches(json.data ?? json.branches ?? []);
      } catch {
        if (!cancelled) setBranches([]);
      }
    }
    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const branchLookup = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch) => map.set(branch.id, branch.name));
    return map;
  }, [branches]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setStatus("Name is required.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        name: form.name.trim(),
        locationType: isCentralCreationPhase ? "warehouse" : form.locationType,
        branchId: isCentralCreationPhase ? null : form.branchId || null,
      };
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Unable to create location.");
      const created = data?.data as InventoryLocation | undefined;
      setStatus(created ? `Location created (${created.code}).` : "Location created.");
      setForm((prev) => ({ ...prev, name: "", branchId: "" }));
      const fresh = await fetch(`/api/company/${companyId}/workshop/inventory/locations`);
      const next = await fresh.json();
      setLocations(next.data ?? []);
    } catch (err: any) {
      setStatus(err?.message || "Failed to create location.");
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const active = locations.filter((loc) => loc.isActive).length;
    const byType: Record<string, number> = {};
    locations.forEach((loc) => {
      byType[loc.locationType] = (byType[loc.locationType] ?? 0) + 1;
    });
    const centralCount = locations.filter((loc) => !loc.branchId && !loc.fleetVehicleId && loc.locationType === "warehouse").length;
    return { count: locations.length, active, byType, centralCount };
  }, [locations]);

  const hasCentral = summary.centralCount > 0;
  const isCentralCreationPhase = !hasCentral;

  useEffect(() => {
    if (!hasCentral) {
      setForm((prev) => ({
        ...prev,
        locationType: "warehouse",
        branchId: "",
      }));
    }
  }, [hasCentral]);

  const previewCode = useMemo(
    () =>
      getPreviewCode(
        locations,
        (isCentralCreationPhase ? "warehouse" : form.locationType) as InventoryLocation["locationType"]
      ),
    [locations, form.locationType, isCentralCreationPhase]
  );

  return (
    <MainPageShell
      title="Inventory Locations"
      subtitle="Every stock movement must originate and land at a valid location."
      scopeLabel={`Company ${companyId}`}
      contentClassName="space-y-6 rounded-2xl border-none bg-slate-950/70 p-0"
    >
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Active locations</h2>
                <p className="text-xs text-muted-foreground">Locations are scoped to the company.</p>
              </div>
              <span className="rounded-full bg-muted/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {summary.count} defined
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border px-3 py-1 text-muted-foreground">
                {summary.active} active
              </span>
              {Object.entries(summary.byType).map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-md border px-3 py-1 text-muted-foreground"
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          <div className="mt-4 overflow-x-auto rounded-md bg-card/80">
            <table className="min-w-full text-xs divide-y divide-muted/30">
              <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-3 px-3 text-left">Code</th>
                  <th className="py-3 px-3 text-left">Name</th>
                  <th className="py-3 px-3 text-left">Type</th>
                  <th className="py-3 px-3 text-left">Branch</th>
                  <th className="py-3 px-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                      Loading locations…
                    </td>
                  </tr>
                ) : error ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-destructive">
                        {error}
                      </td>
                    </tr>
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                      No locations yet.
                    </td>
                  </tr>
                ) : (
                  locations.map((loc) => {
                    const rowIsCentral = !loc.branchId && !loc.fleetVehicleId && loc.locationType === "warehouse";
                    return (
                      <tr key={loc.id} className="bg-transparent hover:bg-muted/10">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span>{loc.code}</span>
                            {rowIsCentral && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                Central
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">{loc.name}</td>
                        <td className="py-2 px-3 capitalize">{loc.locationType}</td>
                        <td className="py-2 px-3 text-[11px] text-muted-foreground">
                          {loc.branchId
                            ? branchLookup.get(loc.branchId) ?? loc.branchId.slice(0, 8)
                            : loc.fleetVehicleId
                            ? `Fleet ${loc.fleetVehicleId.slice(0, 6)}`
                            : "Company (Central)"}
                        </td>
                        <td className="py-2 px-3 text-[11px]">
                          {loc.isActive ? "Active" : "Inactive"}
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Create location</h2>
            <p className="text-xs text-muted-foreground">
              Follow the hierarchy (warehouse → rack → shelf) so every SKU stays traceable.
            </p>
            {isCentralCreationPhase && (
              <p className="text-xs text-amber-300">
                Central warehouse must be created first. A warehouse code (like <span className="font-semibold">WH-M-001</span>) will be auto-assigned.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Code preview: <span className="font-semibold">{previewCode}</span> (auto-assigned per type).
            </p>
            <form className="mt-4 space-y-3 text-sm" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/40"
                  placeholder="Central Warehouse"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Type</span>
                <select
                  value={form.locationType}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, locationType: e.target.value as LocationForm["locationType"] }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/40"
                  disabled={isCentralCreationPhase}
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="branch">Branch</option>
                  <option value="fleet_vehicle">Fleet Vehicle</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Branch (optional)</span>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-primary focus:ring-2 focus:ring-primary/40"
                  disabled={isCentralCreationPhase}
                >
                  <option value="">Company / Central</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name || branch.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add location"}
              </button>
              {status && <p className="text-[11px] text-muted-foreground">{status}</p>}
            </form>
          </article>
        </section>

        <section className="rounded-2xl bg-slate-950/80 p-4 shadow-xl text-sm">
          <h2 className="text-lg font-semibold">Location strategy</h2>
          <p className="text-xs text-muted-foreground">
            Stock never lives at the company level—inventory is always attached to a physical location. Use
            warehouses for bulk holding, racks/shelves for branch layouts, and fleet vehicles to move stock.
          </p>
          <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <li>Define a location code for every distinct place you want to track.</li>
            <li>Keep one SKU master so branches share the same part definitions.</li>
            <li>Keep this list curated: deactivate unused locations instead of deleting them.</li>
          </ul>
        </section>
      </div>
    </MainPageShell>
  );
}
