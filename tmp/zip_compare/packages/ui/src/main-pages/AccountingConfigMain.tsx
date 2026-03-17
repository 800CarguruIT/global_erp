"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { SmartSelect } from "../components/common/SmartSelect";

type AccountOption = { value: string; label: string };
type AccountResponseItem = { id: string; code?: string | null; name: string };

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

type SettingsFieldKey = Exclude<keyof Settings, "companyId">;

type Section = {
  title: string;
  description: string;
  tone: string;
  fields: Array<{ key: SettingsFieldKey; label: string; required: boolean }>;
};

type GlossaryItem = {
  key: string;
  title: string;
  description: string;
};

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
        const opts: AccountOption[] = (accJson.data as AccountResponseItem[] | undefined ?? []).map((a) => ({
          value: a.id,
          label: a.code ? `${a.code} - ${a.name}` : a.name,
        }));
        setAccounts(opts);
        setSettingsState({ status: "loaded", data: cfgJson.data ?? { companyId }, error: null });
      } catch {
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

  const sections = useMemo<Section[]>(
    () => [
      {
        title: "Receivables & Payables",
        description: "Control accounts for customer and supplier balances.",
        tone: "from-cyan-500/20 to-blue-500/5",
        fields: [
          { key: "arControlAccountId", label: "AR control account", required: false },
          { key: "apControlAccountId", label: "AP control account", required: true },
        ],
      },
      {
        title: "Revenue",
        description: "Income buckets by business line.",
        tone: "from-emerald-500/20 to-green-500/5",
        fields: [
          { key: "salesRevenueAccountId", label: "Sales revenue", required: false },
          { key: "workshopRevenueAccountId", label: "Workshop revenue", required: false },
          { key: "rsaRevenueAccountId", label: "RSA revenue", required: false },
          { key: "recoveryRevenueAccountId", label: "Recovery revenue", required: false },
        ],
      },
      {
        title: "Cost & Inventory",
        description: "Stock and production cost mapping.",
        tone: "from-violet-500/20 to-indigo-500/5",
        fields: [
          { key: "cogsAccountId", label: "COGS", required: false },
          { key: "laborCostAccountId", label: "Labor cost", required: false },
          { key: "inventoryAccountId", label: "Inventory", required: true },
          { key: "wipAccountId", label: "Work-in-progress", required: false },
        ],
      },
      {
        title: "Taxes",
        description: "Input and output VAT controls.",
        tone: "from-amber-500/20 to-yellow-500/5",
        fields: [
          { key: "vatOutputAccountId", label: "VAT output (sales)", required: false },
          { key: "vatInputAccountId", label: "VAT input (purchases)", required: false },
        ],
      },
      {
        title: "Discounts & Rounding",
        description: "Adjustments and rounding differences.",
        tone: "from-pink-500/20 to-rose-500/5",
        fields: [
          { key: "discountGivenAccountId", label: "Discount given", required: false },
          { key: "discountReceivedAccountId", label: "Discount received", required: false },
          { key: "roundingDiffAccountId", label: "Rounding diff", required: false },
        ],
      },
      {
        title: "Cash / Bank",
        description: "Payment and clearing accounts.",
        tone: "from-slate-400/20 to-slate-500/5",
        fields: [
          { key: "cashAccountId", label: "Cash account", required: false },
          { key: "bankClearingAccountId", label: "Bank clearing", required: false },
        ],
      },
    ],
    []
  );

  const requiredKeys = useMemo<SettingsFieldKey[]>(() => ["apControlAccountId", "inventoryAccountId"], []);
  const fieldHelp = useMemo<Record<SettingsFieldKey, string>>(
    () => ({
      arControlAccountId: "AR (Accounts Receivable): money customers owe your company.",
      apControlAccountId: "AP (Accounts Payable): money your company owes suppliers.",
      salesRevenueAccountId: "Revenue from direct parts/product sales.",
      workshopRevenueAccountId: "Revenue from workshop jobs and service labor.",
      rsaRevenueAccountId: "Revenue from roadside assistance services.",
      recoveryRevenueAccountId: "Revenue from towing/recovery operations.",
      cogsAccountId: "COGS (Cost of Goods Sold): direct cost of sold parts/items.",
      laborCostAccountId: "Direct labor expense posted for workshop jobs.",
      inventoryAccountId: "Inventory asset account for stock on hand.",
      wipAccountId: "WIP (Work-in-Progress): costs for jobs not yet completed/invoiced.",
      vatOutputAccountId: "VAT output: VAT collected on your sales invoices.",
      vatInputAccountId: "VAT input: VAT paid on purchases, claimable from tax authority.",
      discountGivenAccountId: "Sales discounts you give to customers.",
      discountReceivedAccountId: "Purchase discounts you receive from suppliers.",
      roundingDiffAccountId: "Small rounding differences from invoice/payment totals.",
      cashAccountId: "Cash on hand account used for cash receipts/payments.",
      bankClearingAccountId: "Temporary clearing account for bank settlement timing.",
    }),
    []
  );
  const glossary = useMemo<GlossaryItem[]>(
    () => [
      { key: "AR", title: "Accounts Receivable (AR)", description: "Customer balances receivable." },
      { key: "AP", title: "Accounts Payable (AP)", description: "Supplier balances payable." },
      { key: "COGS", title: "Cost of Goods Sold (COGS)", description: "Direct cost of sold goods." },
      { key: "WIP", title: "Work in Progress (WIP)", description: "Open-job costs before completion." },
      { key: "VAT", title: "Value Added Tax (VAT) Input/Output", description: "Purchase VAT vs collected sales VAT." },
      { key: "REV", title: "Revenue Buckets", description: "Separate sales, workshop, RSA, recovery." },
      { key: "DISC", title: "Discounts", description: "Given to customers or received from vendors." },
      { key: "ROUND", title: "Rounding Difference", description: "Minor rounding adjustments." },
      { key: "INV", title: "Inventory Asset", description: "Stock value held as an asset." },
      { key: "BANK", title: "Bank Clearing", description: "Transit account before bank posting finalizes." },
    ],
    []
  );
  const totalFields = useMemo(() => sections.reduce((sum, section) => sum + section.fields.length, 0), [sections]);
  const mappedFields = useMemo(() => {
    if (!settings) return 0;
    return sections.reduce(
      (sum, section) => sum + section.fields.filter((field) => Boolean(settings[field.key] ?? null)).length,
      0
    );
  }, [sections, settings]);
  const requiredMapped = useMemo(() => {
    if (!settings) return 0;
    return requiredKeys.filter((key) => Boolean(settings[key] ?? null)).length;
  }, [requiredKeys, settings]);
  const completionPct = totalFields > 0 ? Math.round((mappedFields / totalFields) * 100) : 0;
  const requiredReady = requiredMapped === requiredKeys.length;

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
    } catch {
      setSaveError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: SettingsFieldKey, value: string | undefined) {
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
          {saving ? "Saving..." : "Save mappings"}
        </button>
      }
      secondaryActions={
        <>
          {saveSuccess && <span className="text-xs text-emerald-600">Saved</span>}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </>
      }
    >
      {settingsState.status === "loading" && <p className="text-sm text-muted-foreground">Loading settings...</p>}
      {settingsState.status === "error" && (
        <p className="text-sm text-destructive">{settingsState.error ?? "Failed to load settings"}</p>
      )}
      {settingsState.status === "loaded" && settings && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-card/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mapped Fields</div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {mappedFields}/{totalFields}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-card/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Automation Readiness</div>
              <div className={`mt-2 text-xl font-semibold ${requiredReady ? "text-emerald-400" : "text-amber-300"}`}>
                {requiredReady ? "Ready" : "Action Needed"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Required: AP Control + Inventory</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-card/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Available Accounts</div>
              <div className="mt-2 text-xl font-semibold text-foreground">{accounts.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">Source list from company chart of accounts</div>
            </div>
          </div>

          {!requiredReady && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Set AP control account and Inventory to enable fully automated GRN accounting postings.
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Account Terms</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Quick glossary for AP, AR, COGS, WIP, VAT and other mapping terms.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {glossary.map((item) => (
                <div key={item.key} className="rounded-lg border border-white/10 bg-slate-950/30 p-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-300">{item.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sections.map((section) => {
              const mapped = section.fields.filter((f) => Boolean(settings[f.key] ?? null)).length;
              return (
                <div
                  key={section.title}
                  className="rounded-2xl border border-white/10 bg-card/60 p-4 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.9)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <span
                      className={`rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 ${section.tone}`}
                    >
                      {mapped}/{section.fields.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {section.fields.map((f) => {
                      const helpText = fieldHelp[f.key];
                      return (
                        <div key={f.key}>
                          <SmartSelect
                            label={`${f.label}${f.required ? " *" : ""}`}
                            value={settings[f.key] as string | undefined}
                            onChange={(val) => updateField(f.key, val)}
                            options={accounts}
                            placeholder="Select account"
                          />
                          {helpText && <p className="mt-1 text-[11px] text-muted-foreground">{helpText}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-3 z-10">
            <div className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  Completion: <span className="font-semibold text-white">{completionPct}%</span>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save mappings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
