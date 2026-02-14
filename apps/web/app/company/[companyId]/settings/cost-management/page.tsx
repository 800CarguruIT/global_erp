"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { ReferenceData } from "@repo/ai-core/client";

type CostSettings = {
  inspectionFixedAmount: number;
  currency: string;
  vatRate: number;
};

export default function CompanyCostManagementPage() {
  const params = useParams();
  const companyId = Array.isArray(params?.companyId) ? params.companyId[0] : (params?.companyId as string | undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const countries = useMemo(() => ReferenceData.ReferenceCountries.allCountries, []);
  const currencyOptions = useMemo(
    () =>
      Array.from(new Set(countries.map((c) => String(c.currency ?? "").trim().toUpperCase()).filter(Boolean))).sort(),
    [countries]
  );
  const [form, setForm] = useState<CostSettings>({
    inspectionFixedAmount: 0,
    currency: "USD",
    vatRate: 0,
  });

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/cost-settings`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load cost settings");
        const json = await res.json();
        const data = json?.data ?? {};
        if (!active) return;
        setForm({
          inspectionFixedAmount: Number(data.inspectionFixedAmount ?? 0),
          currency: String(data.currency ?? "USD"),
          vatRate: Number(data.vatRate ?? 0),
        });
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load cost settings");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    async function detectCurrencyByLocation() {
      if (currencyTouched) return;
      try {
        const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const iso2 = String(data?.country_code ?? "").toUpperCase();
          const country = countries.find((c) => String(c.iso2 ?? "").toUpperCase() === iso2);
          const currency = String(country?.currency ?? "").toUpperCase();
          if (!cancelled && currency && (!form.currency || form.currency === "USD")) {
            setForm((prev) => ({ ...prev, currency }));
            setLocationHint(`Auto-selected by IP country (${iso2})`);
            return;
          }
        }
      } catch {
        // ignore
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const byTimezone = countries.find((c) => String(c.timezone ?? "") === tz);
      const currency = String(byTimezone?.currency ?? "").toUpperCase();
      if (!cancelled && currency && (!form.currency || form.currency === "USD")) {
        setForm((prev) => ({ ...prev, currency }));
        setLocationHint("Auto-selected by current timezone");
      }
    }
    void detectCurrencyByLocation();
    return () => {
      cancelled = true;
    };
  }, [countries, currencyTouched, form.currency]);

  async function save() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/cost-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error ?? "Failed to save settings");
      }
      setMessage("Saved");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="mr-auto ml-0 w-full max-w-4xl space-y-6 px-3 py-6 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-900/30 via-slate-900/40 to-emerald-900/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Company</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100 sm:text-3xl">Cost Management</h1>
          <p className="mt-1 text-sm text-slate-300/90">
            Configure fixed inspection cost and VAT for third-party workshop earnings.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">Loading settings...</div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-900/20 p-3 text-sm text-rose-300">{error}</div>
        ) : null}
        {message ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-3 text-sm text-emerald-300">{message}</div>
        ) : null}

        {!loading ? (
          <div className="space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-950/45 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Inspection Cost</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-11 w-full rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  value={form.inspectionFixedAmount}
                  onChange={(e) => setForm((prev) => ({ ...prev, inspectionFixedAmount: Number(e.target.value || 0) }))}
                />
                <p className="text-[11px] text-slate-400">Fixed earning value per verified third-party inspection.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Currency</label>
                <select
                  className="h-11 w-full rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 text-sm uppercase text-slate-100 outline-none focus:border-cyan-300/60"
                  value={form.currency}
                  onChange={(e) => {
                    setCurrencyTouched(true);
                    setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }));
                  }}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  {locationHint ?? "Auto-selected from current location, you can override manually."}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">VAT Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="h-11 w-full rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  value={form.vatRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, vatRate: Number(e.target.value || 0) }))}
                />
                <p className="text-[11px] text-slate-400">Applied on net amount after fines.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="h-10 rounded-lg bg-cyan-500 px-5 text-xs font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving}
                onClick={save}
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
