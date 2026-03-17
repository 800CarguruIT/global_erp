"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  Gatepass,
  GatepassHandoverType,
  GatepassStatus,
} from "@repo/ai-core/workshop/gatepass/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function GatepassDetailMain({
  companyId,
  gatepassId,
}: {
  companyId: string;
  gatepassId: string;
}) {
  const [state, setState] = useState<LoadState<{ gatepass: Gatepass }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [patch, setPatch] = useState<Partial<Gatepass>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/gatepass/${gatepassId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const gatepass: Gatepass = json.data?.gatepass ?? json.data;
        if (!cancelled) {
          setState({ status: "loaded", data: { gatepass }, error: null });
          setPatch({
            handoverType: gatepass.handoverType,
            paymentOk: gatepass.paymentOk,
            customerSigned: gatepass.customerSigned,
            customerName: gatepass.customerName ?? "",
            customerIdNumber: gatepass.customerIdNumber ?? "",
            handoverFormRef: gatepass.handoverFormRef ?? "",
            customerSignatureRef: gatepass.customerSignatureRef ?? "",
            finalVideoRef: gatepass.finalVideoRef ?? "",
            finalNote: gatepass.finalNote ?? "",
            status: gatepass.status,
          });
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load gatepass." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, gatepassId]);

  async function save(extra?: any) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = { ...patch, ...(extra ?? {}) };
      const res = await fetch(`/api/company/${companyId}/workshop/gatepass/${gatepassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Gatepass" subtitle="Loading gatepass" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Gatepass" subtitle="Unable to load gatepass" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const gp = state.data.gatepass;

  return (
    <MainPageShell
      title="Gatepass"
      subtitle="Finalize handover and close the lead."
      scopeLabel={`Invoice ${gp.invoiceId.slice(0, 8)}…`}
      primaryAction={
        <button
          type="button"
          onClick={() => save()}
          className="rounded-md border px-3 py-1 text-sm font-medium"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => save({ approvePayment: { supervisorId: null } })}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            Approve payment
          </button>
          <button
            type="button"
            onClick={() => save({ release: true })}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            Release & Close Lead
          </button>
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField
              label="Status"
              value={patch.status ?? gp.status}
              onChange={(v) => setPatch((p) => ({ ...p, status: v as GatepassStatus }))}
              options={["pending", "ready", "released", "cancelled"]}
            />
            <SelectField
              label="Handover type"
              value={patch.handoverType ?? gp.handoverType}
              onChange={(v) => setPatch((p) => ({ ...p, handoverType: v as GatepassHandoverType }))}
              options={["branch", "dropoff_recovery"]}
            />
            <TextField label="Amount due" value={gp.amountDue.toFixed(2)} onChange={() => {}} readOnly />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!patch.paymentOk}
                onChange={(e) => setPatch((p) => ({ ...p, paymentOk: e.target.checked }))}
              />
              Payment OK / Supervisor approved
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!patch.customerSigned}
                onChange={(e) => setPatch((p) => ({ ...p, customerSigned: e.target.checked }))}
              />
              Customer signed
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Handover details</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Customer name"
              value={patch.customerName ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, customerName: v }))}
            />
            <TextField
              label="Customer ID / passport"
              value={patch.customerIdNumber ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, customerIdNumber: v }))}
            />
            <TextField
              label="Handover form URL"
              value={patch.handoverFormRef ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, handoverFormRef: v }))}
            />
            <TextField
              label="Signature image URL"
              value={patch.customerSignatureRef ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, customerSignatureRef: v }))}
            />
            <TextField
              label="Final video URL"
              value={patch.finalVideoRef ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, finalVideoRef: v }))}
            />
          </div>
          <TextareaField
            label="Final note"
            value={patch.finalNote ?? ""}
            onChange={(v) => setPatch((p) => ({ ...p, finalNote: v }))}
          />
        </section>
      </div>
    </MainPageShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <input
        className="w-full rounded border bg-background px-2 py-1 text-sm"
        value={value}
        readOnly={readOnly}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <select className="w-full rounded border bg-background px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <textarea
        className="h-24 w-full resize-none rounded border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

