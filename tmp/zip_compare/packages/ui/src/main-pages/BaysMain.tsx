"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  BayBranchSummary,
  BayStatus,
  BayType,
  WorkshopBay,
} from "@repo/ai-core/operations/bays/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type BayFormState = {
  branchId: string;
  code: string;
  name: string;
  bayType: BayType;
  capacityCars?: number;
  status?: BayStatus;
  isActive?: boolean;
  notes?: string;
};

const defaultForm: BayFormState = {
  branchId: "",
  code: "",
  name: "",
  bayType: "mechanical",
  capacityCars: 1,
  status: "available",
  isActive: true,
};

export function BaysMain({ companyId }: { companyId: string }) {
  const [bayState, setBayState] = useState<LoadState<WorkshopBay[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [summary, setSummary] = useState<BayBranchSummary[]>([]);
  const [filters, setFilters] = useState<{ branchId?: string; status?: string; bayType?: string }>({
    status: "any",
    bayType: "any",
  });
  const [editing, setEditing] = useState<WorkshopBay | null>(null);
  const [form, setForm] = useState<BayFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBayState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams();
        if (filters.branchId) params.set("branchId", filters.branchId);
        if (filters.status && filters.status !== "any") params.set("status", filters.status);
        if (filters.bayType && filters.bayType !== "any") params.set("bayType", filters.bayType);

        const [baysRes, summaryRes] = await Promise.all([
          fetch(`/api/company/${companyId}/bays?${params.toString()}`),
          fetch(`/api/company/${companyId}/bays/summary`),
        ]);
        if (!baysRes.ok) throw new Error(`HTTP ${baysRes.status}`);
        const baysJson = await baysRes.json();
        const summaryJson = summaryRes.ok ? await summaryRes.json() : { data: [] };
        if (!cancelled) {
          setBayState({ status: "loaded", data: baysJson.data ?? [], error: null });
          setSummary(summaryJson.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setBayState({ status: "error", data: null, error: "Failed to load bays." });
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

  function handleEdit(item?: WorkshopBay) {
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
      bayType: item.bayType,
      capacityCars: item.capacityCars,
      status: item.status,
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = { ...form, capacityCars: form.capacityCars ?? 1 };
      const res = await fetch(
        editing ? `/api/company/${companyId}/bays/${editing.id}` : `/api/company/${companyId}/bays`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      handleEdit(undefined);

      const params = new URLSearchParams();
      if (filters.branchId) params.set("branchId", filters.branchId);
      if (filters.status && filters.status !== "any") params.set("status", filters.status);
      if (filters.bayType && filters.bayType !== "any") params.set("bayType", filters.bayType);
      const [baysRes, summaryRes] = await Promise.all([
        fetch(`/api/company/${companyId}/bays?${params.toString()}`),
        fetch(`/api/company/${companyId}/bays/summary`),
      ]);
      const baysJson = await baysRes.json();
      const summaryJson = summaryRes.ok ? await summaryRes.json() : { data: [] };
      setBayState({ status: "loaded", data: baysJson.data ?? [], error: null });
      setSummary(summaryJson.data ?? []);
    } catch (err) {
      setFormError("Failed to save bay");
    } finally {
      setIsSaving(false);
    }
  }

  const isLoading = bayState.status === "loading";
  const loadError = bayState.status === "error" ? bayState.error : null;
  const bays = bayState.status === "loaded" ? bayState.data : [];

  return (
    <MainPageShell
      title="Workshop Bays"
      subtitle="Manage bay capacity and availability per branch."
      scopeLabel="Company bays"
      primaryAction={
        <button
          type="button"
          onClick={() => handleEdit(undefined)}
          className="rounded-md border px-3 py-1 text-sm font-medium"
        >
          Add bay
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
            value={filters.bayType ?? "any"}
            onChange={(e) => setFilters((prev) => ({ ...prev, bayType: e.target.value }))}
          >
            <option value="any">All types</option>
            <option value="mechanical">Mechanical</option>
            <option value="body">Body</option>
            <option value="paint">Paint</option>
            <option value="other">Other</option>
          </select>
          <select
            className="rounded border bg-background px-3 py-2"
            value={filters.status ?? "any"}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="any">All status</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {/* Summary */}
        {summaryForBranch.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryForBranch.map((s) => (
              <div key={s.branchId} className="rounded-xl border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground">Branch {s.branchId}</div>
                <div className="mt-1 text-lg font-semibold">{s.total} bays</div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <div>Available</div>
                  <div className="text-right">{s.available}</div>
                  <div>Occupied</div>
                  <div className="text-right">{s.occupied}</div>
                  <div>Maint.</div>
                  <div className="text-right">{s.maintenance}</div>
                  <div>Blocked</div>
                  <div className="text-right">{s.blocked}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {isLoading && <p className="text-sm text-muted-foreground">Loading bays…</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!isLoading && !loadError && (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="py-2 px-3 text-left">Code</th>
                  <th className="py-2 px-3 text-left">Name</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Branch</th>
                  <th className="py-2 px-3 text-left">Capacity</th>
                  <th className="py-2 px-3 text-left">Status</th>
                  <th className="py-2 px-3 text-left">Active</th>
                  <th className="py-2 px-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bays.length === 0 ? (
                  <tr>
                    <td className="py-3 px-4 text-sm text-muted-foreground" colSpan={8}>
                      No bays found.
                    </td>
                  </tr>
                ) : (
                  bays.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium">{b.code}</td>
                      <td className="py-2 px-3">{b.name}</td>
                      <td className="py-2 px-3 capitalize text-xs">{b.bayType}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{b.branchId}</td>
                      <td className="py-2 px-3 text-xs">{b.capacityCars}</td>
                      <td className="py-2 px-3 text-xs capitalize">{b.status}</td>
                      <td className="py-2 px-3 text-xs">{b.isActive ? "Yes" : "No"}</td>
                      <td className="py-2 px-3 text-xs">
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px]"
                          onClick={() => handleEdit(b)}
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
            <h3 className="text-sm font-semibold">{editing ? "Edit bay" : "Add bay"}</h3>
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
              value={form.bayType}
              onChange={(e) => setForm((prev) => ({ ...prev, bayType: e.target.value as BayType }))}
            >
              <option value="mechanical">Mechanical</option>
              <option value="body">Body</option>
              <option value="paint">Paint</option>
              <option value="other">Other</option>
            </select>
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
              type="number"
              min={1}
              placeholder="Capacity (cars)"
              value={form.capacityCars ?? 1}
              onChange={(e) => setForm((prev) => ({ ...prev, capacityCars: Number(e.target.value) }))}
            />
            <select
              className="rounded border bg-background px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as BayStatus }))}
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
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
