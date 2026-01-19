"use client";

import React, { useState } from "react";

export interface LeadFormValues {
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status?: string | null;
  ownerId?: string | null;
}

export interface LeadFormProps {
  mode: "create" | "edit";
  initialValues?: LeadFormValues;
  owners?: Array<{ id: string; name: string }>;
  onSubmit: (values: LeadFormValues) => Promise<void>;
  onCancel?: () => void;
}

export function LeadForm({ mode, initialValues, owners = [], onSubmit, onCancel }: LeadFormProps) {
  const [form, setForm] = useState<LeadFormValues>(
    initialValues ?? {
      name: "",
      phone: "",
      email: "",
      source: "",
      status: "open",
      ownerId: owners[0]?.id ?? undefined,
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save lead");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold">Name</label>
          <input
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Lead contact name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Phone</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+9715..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Email</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="email"
            value={form.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="lead@example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Source</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.source ?? ""}
            onChange={(e) => update("source", e.target.value)}
            placeholder="call / website / referral"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Status</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.status ?? "open"}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="open">New / Open</option>
            <option value="processing">In Progress</option>
            <option value="closed_won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        {owners.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-semibold">Owner</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.ownerId ?? ""}
              onChange={(e) => update("ownerId", e.target.value || undefined)}
            >
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-white/10"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Lead" : "Save Changes"}
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
