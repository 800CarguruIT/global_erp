"use client";

import React, { useMemo, useState } from "react";

export interface WorkshopJobFormValues {
  estimateId?: string | null;
  customerId?: string | null;
  carId?: string | null;
  jobType?: string | null;
  status?: string | null;
  assignedEmployeeId?: string | null;
  notes?: string | null;
}

export interface WorkshopJobFormProps {
  mode: "create" | "edit";
  initialValues?: WorkshopJobFormValues;
  customers: Array<{ id: string; name: string }>;
  cars: Array<{ id: string; label: string; customerId: string }>;
  employees: Array<{ id: string; name: string }>;
  onSubmit: (values: WorkshopJobFormValues) => Promise<void>;
  onCancel?: () => void;
}

export function WorkshopJobForm({
  mode,
  initialValues,
  customers,
  cars,
  employees,
  onSubmit,
  onCancel,
}: WorkshopJobFormProps) {
  const [form, setForm] = useState<WorkshopJobFormValues>({
    estimateId: initialValues?.estimateId ?? "",
    customerId: initialValues?.customerId ?? "",
    carId: initialValues?.carId ?? "",
    jobType: initialValues?.jobType ?? "",
    status: initialValues?.status ?? "draft",
    assignedEmployeeId: initialValues?.assignedEmployeeId ?? "",
    notes: initialValues?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCars = useMemo(() => {
    if (!form.customerId) return cars;
    return cars.filter((c) => c.customerId === form.customerId);
  }, [cars, form.customerId]);

  function update<K extends keyof WorkshopJobFormValues>(key: K, value: WorkshopJobFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold">Estimate ID</label>
          <input
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.estimateId ?? ""}
            onChange={(e) => update("estimateId", e.target.value)}
            placeholder="Estimate ID (required)"
          />
          <p className="text-[11px] text-muted-foreground">Work orders currently require an existing estimate.</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Customer</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.customerId ?? ""}
            onChange={(e) => update("customerId", e.target.value || undefined)}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Car</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.carId ?? ""}
            onChange={(e) => update("carId", e.target.value || undefined)}
          >
            <option value="">Select car</option>
            {filteredCars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Job Type</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.jobType ?? ""}
            onChange={(e) => update("jobType", e.target.value)}
            placeholder="e.g. Inspection, Service"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Status</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.status ?? "draft"}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="quoting">Quoting</option>
            <option value="queue">Queue</option>
            <option value="waiting_parts">Waiting Parts</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Assigned Technician</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.assignedEmployeeId ?? ""}
            onChange={(e) => update("assignedEmployeeId", e.target.value || undefined)}
          >
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold">Notes</label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Internal notes"
        />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-white/10"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Job" : "Save Changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/5"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
