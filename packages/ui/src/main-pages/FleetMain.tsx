"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  FleetBranchSummary,
  FleetStatus,
  FleetVehicle,
  FleetVehicleType,
} from "@repo/ai-core/operations/fleet/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type FleetFormState = {
  branchId: string;
  code: string;
  name: string;
  vehicleType: FleetVehicleType;
  plateNumber?: string;
  make?: string;
  model?: string;
  modelYear?: number;
  capacityJobs?: number;
  status?: FleetStatus;
  isActive?: boolean;
  notes?: string;
};

const defaultForm: FleetFormState = {
  branchId: "",
  code: "",
  name: "",
  vehicleType: "rsa",
  capacityJobs: 1,
  status: "available",
  isActive: true,
};

export function FleetMain({ companyId }: { companyId: string }) {
  const [fleetState, setFleetState] = useState<LoadState<FleetVehicle[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [summary, setSummary] = useState<FleetBranchSummary[]>([]);
  const [filters, setFilters] = useState<{ branchId?: string; status?: string; vehicleType?: string }>({
    status: "any",
    vehicleType: "any",
  });
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [form, setForm] = useState<FleetFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load list + summary
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFleetState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams();
        if (filters.branchId) params.set("branchId", filters.branchId);
        if (filters.status && filters.status !== "any") params.set("status", filters.status);
        if (filters.vehicleType && filters.vehicleType !== "any") params.set("vehicleType", filters.vehicleType);

        const [fleetRes, summaryRes] = await Promise.all([
          fetch(`/api/company/${companyId}/fleet?${params.toString()}`),
          fetch(`/api/company/${companyId}/fleet/summary`),
        ]);
        if (!fleetRes.ok) throw new Error(`HTTP ${fleetRes.status}`);
        const fleetJson = await fleetRes.json();
        const summaryJson = summaryRes.ok ? await summaryRes.json() : { data: [] };
        if (!cancelled) {
          setFleetState({ status: "loaded", data: fleetJson.data ?? [], error: null });
          setSummary(summaryJson.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setFleetState({ status: "error", data: null, error: "Failed to load fleet." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, filters]);

  const summaryForBranch = useMemo(() => {
    if (!filters.branchId) return summary;
    return summary.filter((s) => s.branchId === filters.branchId);
  }, [summary, filters.branchId]);

  function handleEdit(item?: FleetVehicle) {
    if (!item) {
      setEditing(null);
      setForm(defaultForm);
      return;
    }
    setEditing(item);
    setForm({
      branchId: item.branchId,
      code: item.code,
      name: item.name,
      vehicleType: item.vehicleType,
      plateNumber: item.plateNumber ?? "",
      make: item.make ?? "",
      model: item.model ?? "",
      modelYear: item.modelYear ?? undefined,
      capacityJobs: item.capacityJobs,
      status: item.status,
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = { ...form, capacityJobs: form.capacityJobs ?? 1 };
      const res = await fetch(
        editing
          ? `/api/company/${companyId}/fleet/${editing.id}`
          : `/api/company/${companyId}/fleet`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      handleEdit(undefined);
      // reload
      const params = new URLSearchParams();
      if (filters.branchId) params.set("branchId", filters.branchId);
      if (filters.status && filters.status !== "any") params.set("status", filters.status);
      if (filters.vehicleType && filters.vehicleType !== "any") params.set("vehicleType", filters.vehicleType);
      const [fleetRes, summaryRes] = await Promise.all([
        fetch(`/api/company/${companyId}/fleet?${params.toString()}`),
        fetch(`/api/company/${companyId}/fleet/summary`),
      ]);
      const fleetJson = await fleetRes.json();
      const summaryJson = summaryRes.ok ? await summaryRes.json() : { data: [] };
      setFleetState({ status: "loaded", data: fleetJson.data ?? [], error: null });
      setSummary(summaryJson.data ?? []);
    } catch (err) {
      setFormError("Failed to save fleet vehicle");
    } finally {
      setIsSaving(false);
    }
  }

  const isLoading = fleetState.status === "loading";
  const loadError = fleetState.status === "error" ? fleetState.error : null;
  const fleet = fleetState.status === "loaded" ? fleetState.data : [];

  return (
    <MainPageShell
      title="Fleet"
      subtitle="Manage RSA, recovery, and parts vehicles per branch."
      scopeLabel="Company fleet"
      primaryAction={
        <button
          type="button"
          onClick={() => handleEdit(undefined)}
          className="rounded-md border px-3 py-1 text-sm font-medium"
        >
          Add fleet vehicle
        </button>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 text-sm">
          <input
            className="rounded border bg-background px-3 py-2"
            placeholder="Branch ID"
            value={filters.branchId ?? ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined }))}
          />
          <select
            className="rounded border bg-background px-3 py-2"
            value={filters.vehicleType ?? "any"}
            onChange={(e) => setFilters((prev) => ({ ...prev, vehicleType: e.target.value }))}
          >
            <option value="any">All types</option>
            <option value="rsa">RSA</option>
            <option value="recovery">Recovery</option>
            <option value="parts">Parts</option>
            <option value="other">Other</option>
          </select>
          <select
            className="rounded border bg-background px-3 py-2"
            value={filters.status ?? "any"}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="any">All status</option>
            <option value="available">Available</option>
            <option value="on_job">On job</option>
            <option value="maintenance">Maintenance</option>
            <option value="out_of_service">Out of service</option>
          </select>
        </div>

        {/* Summary */}
        {summaryForBranch.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryForBranch.map((s) => (
              <div key={s.branchId} className="rounded-xl border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground">Branch {s.branchId}</div>
                <div className="mt-1 text-lg font-semibold">{s.total} vehicles</div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <div>Available</div>
                  <div className="text-right">{s.available}</div>
                  <div>On job</div>
                  <div className="text-right">{s.onJob}</div>
                  <div>Maint.</div>
                  <div className="text-right">{s.maintenance}</div>
                  <div>Out of svc.</div>
                  <div className="text-right">{s.outOfService}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {isLoading && <p className="text-sm text-muted-foreground">Loading fleet…</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!isLoading && !loadError && (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="py-2 px-3 text-left">Code</th>
                  <th className="py-2 px-3 text-left">Name</th>
                  <th className="py-2 px-3 text-left">Plate</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Branch</th>
                  <th className="py-2 px-3 text-left">Capacity</th>
                  <th className="py-2 px-3 text-left">Status</th>
                  <th className="py-2 px-3 text-left">Active</th>
                  <th className="py-2 px-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fleet.length === 0 ? (
                  <tr>
                    <td className="py-3 px-4 text-sm text-muted-foreground" colSpan={9}>
                      No fleet vehicles found.
                    </td>
                  </tr>
                ) : (
                  fleet.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium">{f.code}</td>
                      <td className="py-2 px-3">{f.name}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{f.plateNumber || "—"}</td>
                      <td className="py-2 px-3 capitalize text-xs">{f.vehicleType}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{f.branchId}</td>
                      <td className="py-2 px-3 text-xs">{f.capacityJobs}</td>
                      <td className="py-2 px-3 text-xs capitalize">{f.status.replace("_", " ")}</td>
                      <td className="py-2 px-3 text-xs">{f.isActive ? "Yes" : "No"}</td>
                      <td className="py-2 px-3 text-xs">
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px]"
                          onClick={() => handleEdit(f)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Form */}
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editing ? "Edit fleet vehicle" : "Add fleet vehicle"}</h3>
            {editing && (
              <button className="text-xs text-muted-foreground" onClick={() => handleEdit(undefined)} type="button">
                Clear
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Branch ID"
              value={form.branchId}
              onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
            />
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
              className="rounded border bg-background px-3 py-2 text-sm"
              value={form.vehicleType}
              onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value as FleetVehicleType }))}
            >
              <option value="rsa">RSA</option>
              <option value="recovery">Recovery</option>
              <option value="parts">Parts</option>
              <option value="other">Other</option>
            </select>
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Plate number"
              value={form.plateNumber ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, plateNumber: e.target.value }))}
            />
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Make"
              value={form.make ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, make: e.target.value }))}
            />
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Model"
              value={form.model ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
            />
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              type="number"
              placeholder="Model year"
              value={form.modelYear ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, modelYear: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              type="number"
              min={1}
              placeholder="Capacity (jobs)"
              value={form.capacityJobs ?? 1}
              onChange={(e) => setForm((prev) => ({ ...prev, capacityJobs: Number(e.target.value) }))}
            />
            <select
              className="rounded border bg-background px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as FleetStatus }))}
            >
              <option value="available">Available</option>
              <option value="on_job">On job</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of service</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active
            </label>
            <textarea
              className="rounded border bg-background px-3 py-2 text-sm md:col-span-2"
              placeholder="Notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md border px-3 py-1 font-medium"
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : editing ? "Update" : "Create"}
            </button>
            {formError && <span className="text-destructive text-xs">{formError}</span>}
          </div>
        </div>
      </div>
    </MainPageShell>
  );
}
