"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, Card } from "@repo/ui";
import type { BayType, BayStatus, WorkshopBay } from "@repo/ai-core";

type Props =
  | { params: { companyId: string; branchId: string } }
  | { params: Promise<{ companyId: string; branchId: string }> };

type BayForm = {
  id?: string;
  number: string;
  bayType: BayType;
  notes?: string | null;
  status: BayStatus; // internal
  capacityCars: number; // internal
  isActive: boolean; // internal
};

const bayTypes: BayType[] = ["mechanical", "body", "paint", "other"];

export default function BranchBaysPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [bays, setBays] = useState<WorkshopBay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BayForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setBranchId(p?.branchId ?? null);
    });
  }, [params]);

  const filteredBays = useMemo(() => bays, [bays]);

  async function loadBays() {
    if (!companyId || !branchId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ branchId });
      const res = await fetch(`/api/company/${companyId}/bays?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setBays(json?.data ?? json ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load bays");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBays();
  }, [companyId, branchId]);

  const resetForm = () =>
    setForm({
      number: "",
      bayType: "mechanical",
      notes: "",
      status: "available",
      capacityCars: 1,
      isActive: true,
    });

  async function handleSave() {
    if (!companyId || !branchId || !form) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        branchId,
        code: form.number.trim(),
        name: form.number.trim(),
        bayType: form.bayType,
        status: form.status,
        capacityCars: form.capacityCars,
        isActive: form.isActive,
        notes: form.notes?.trim() || null,
      };
      const url = form.id ? `/api/company/${companyId}/bays/${form.id}` : `/api/company/${companyId}/bays`;
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadBays();
      setForm(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save bay");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Branch Bays</h1>
            <p className="text-sm text-muted-foreground">Manage bay number, type, and notes for this branch.</p>
          </div>
          <button
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
            onClick={resetForm}
          >
            Add Bay
          </button>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading ? <div className="text-sm text-muted-foreground">Loading bays...</div> : null}

        {!loading && filteredBays.length === 0 ? (
          <div className="text-sm text-muted-foreground">No bays yet.</div>
        ) : null}

        {!loading && filteredBays.length > 0 ? (
          <Card className="p-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left">Number</th>
                    <th className="py-2 text-left">Type</th>
                    <th className="py-2 text-left">Notes</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBays.map((bay) => (
                    <tr key={bay.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{bay.code}</td>
                      <td className="py-2 pr-4 capitalize">{bay.bayType}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{bay.notes || "—"}</td>
                      <td className="py-2 pr-4 space-x-2">
                        <button
                          className="rounded border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() =>
                            setForm({
                              id: bay.id,
                              number: bay.code,
                              bayType: bay.bayType,
                              status: bay.status ?? "available",
                              capacityCars: bay.capacityCars ?? 1,
                              isActive: bay.isActive ?? true,
                              notes: bay.notes ?? "",
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="rounded border border-red-500 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                          onClick={async () => {
                            if (!companyId || !confirm("Delete this bay?")) return;
                            try {
                              const res = await fetch(`/api/company/${companyId}/bays/${bay.id}`, {
                                method: "DELETE",
                              });
                              if (!res.ok) throw new Error(await res.text());
                              await loadBays();
                            } catch (err: any) {
                              setError(err?.message ?? "Failed to delete bay");
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {form && (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">{form.id ? "Edit Bay" : "Add Bay"}</div>
                <div className="text-xs text-muted-foreground">Track bay details.</div>
              </div>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setForm(null)}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Number</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.number}
                  onChange={(e) => setForm((prev) => prev && { ...prev, number: e.target.value })}
                />
              </div>
              <input type="hidden" value={form.status} readOnly />
              <input type="hidden" value={form.capacityCars} readOnly />
              <input type="hidden" value={form.isActive ? "true" : "false"} readOnly />
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.bayType}
                  onChange={(e) => setForm((prev) => prev && { ...prev, bayType: e.target.value as BayType })}
                >
                  {bayTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((prev) => prev && { ...prev, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                disabled={saving || !form.number.trim()}
                onClick={handleSave}
              >
                {saving ? "Saving..." : form.id ? "Save changes" : "Create bay"}
              </button>
              <button className="rounded-md border px-4 py-2 text-sm hover:bg-muted" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </Card>
        )}

        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Live Usage</div>
          <div className="text-xs text-muted-foreground">
            Usage details (technician, car, job, timer) are not available yet in this environment.
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
