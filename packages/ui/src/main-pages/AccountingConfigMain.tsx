"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { SmartSelect } from "../components/common/SmartSelect";

type AccountOption = { value: string; label: string };

type Settings = {
  companyId: string;
  arControlAccountId?: string | null;
  apControlAccountId?: string | null;
  salesRevenueAccountId?: string | null;
  workshopRevenueAccountId?: string | null;
  rsaRevenueAccountId?: string | null;
  recoveryRevenueAccountId?: string | null;
  cogsAccountId?: string | null;
  laborCostAccountId?: string | null;
  inventoryAccountId?: string | null;
  wipAccountId?: string | null;
  vatOutputAccountId?: string | null;
  vatInputAccountId?: string | null;
  discountGivenAccountId?: string | null;
  discountReceivedAccountId?: string | null;
  roundingDiffAccountId?: string | null;
  cashAccountId?: string | null;
  bankClearingAccountId?: string | null;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function AccountingConfigMain({ companyId }: { companyId: string }) {
  const [settingsState, setSettingsState] = useState<LoadState<Settings>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // load settings + accounts
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSettingsState({ status: "loading", data: null, error: null });
      try {
        const [cfgRes, accRes] = await Promise.all([
          fetch(`/api/company/${companyId}/accounting/config`),
          fetch(`/api/company/${companyId}/accounting/accounts`),
        ]);
        const cfgJson = await cfgRes.json();
        const accJson = await accRes.json();
        if (cancelled) return;
        const opts: AccountOption[] = (accJson.data ?? []).map((a: any) => ({
          value: a.id,
          label: a.code ? `${a.code} – ${a.name}` : a.name,
        }));
        setAccounts(opts);
        setSettingsState({ status: "loaded", data: cfgJson.data ?? { companyId }, error: null });
      } catch (err) {
        if (!cancelled) {
          setSettingsState({ status: "error", data: null, error: "Failed to load config" });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const settings = settingsState.status === "loaded" ? settingsState.data : null;

  const sections = useMemo(
    () => [
      {
        title: "Receivables & Payables",
        fields: [
          { key: "arControlAccountId", label: "AR control account" },
          { key: "apControlAccountId", label: "AP control account" },
        ],
      },
      {
        title: "Revenue",
        fields: [
          { key: "salesRevenueAccountId", label: "Sales revenue" },
          { key: "workshopRevenueAccountId", label: "Workshop revenue" },
          { key: "rsaRevenueAccountId", label: "RSA revenue" },
          { key: "recoveryRevenueAccountId", label: "Recovery revenue" },
        ],
      },
      {
        title: "Cost & Inventory",
        fields: [
          { key: "cogsAccountId", label: "COGS" },
          { key: "laborCostAccountId", label: "Labor cost" },
          { key: "inventoryAccountId", label: "Inventory" },
          { key: "wipAccountId", label: "Work-in-progress" },
        ],
      },
      {
        title: "Taxes",
        fields: [
          { key: "vatOutputAccountId", label: "VAT output (sales)" },
          { key: "vatInputAccountId", label: "VAT input (purchases)" },
        ],
      },
      {
        title: "Discounts & Rounding",
        fields: [
          { key: "discountGivenAccountId", label: "Discount given" },
          { key: "discountReceivedAccountId", label: "Discount received" },
          { key: "roundingDiffAccountId", label: "Rounding diff" },
        ],
      },
      {
        title: "Cash / Bank",
        fields: [
          { key: "cashAccountId", label: "Cash account" },
          { key: "bankClearingAccountId", label: "Bank clearing" },
        ],
      },
    ],
    []
  );

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
    } catch (err) {
      setSaveError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof Settings, value: string | undefined) {
    setSettingsState((prev) => {
      if (prev.status !== "loaded" || !prev.data) return prev;
      return {
        status: "loaded",
        data: { ...prev.data, [key]: value ?? null },
        error: null,
      };
    });
  }

  return (
    <MainPageShell
      title="Accounting Configuration"
      subtitle="Map operational modules to GL accounts for this company."
      scopeLabel="Company accounting"
      primaryAction={
        <button
          type="button"
          className="rounded-md border px-3 py-1 text-sm font-medium"
          onClick={handleSave}
          disabled={saving || settingsState.status === "loading"}
        >
          {saving ? "Saving…" : "Save mappings"}
        </button>
      }
      secondaryActions={
        <>
          {saveSuccess && <span className="text-xs text-emerald-600">Saved</span>}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </>
      }
    >
      {settingsState.status === "loading" && <p className="text-sm text-muted-foreground">Loading settings…</p>}
      {settingsState.status === "error" && (
        <p className="text-sm text-destructive">{settingsState.error ?? "Failed to load settings"}</p>
      )}
      {settingsState.status === "loaded" && settings && (
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="rounded-xl border bg-card/60 p-4">
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              <div className="mt-3 space-y-3">
                {section.fields.map((f) => (
                  <SmartSelect
                    key={f.key}
                    label={f.label}
                    value={settings[f.key as keyof Settings] as string | undefined}
                    onChange={(val) => updateField(f.key as keyof Settings, val)}
                    options={accounts}
                    placeholder="Select account"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainPageShell>
  );
}
