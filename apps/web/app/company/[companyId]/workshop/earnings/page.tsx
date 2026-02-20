"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { DateRange } from "react-date-range";

type EarningsRow = {
  id: string;
  earning_source?: "inspection" | "job_card" | null;
  inspection_id?: string | null;
  job_card_id?: string | null;
  branch_id?: string | null;
  currency?: string | null;
  gross_amount?: number | null;
  fine_amount?: number | null;
  net_before_vat?: number | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
  total_payable?: number | null;
  verified_at?: string | null;
  start_at?: string | null;
  complete_at?: string | null;
  plate_number?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  branch_display_name?: string | null;
  branch_name?: string | null;
  branch_code?: string | null;
};

type WorkshopOption = {
  id: string;
  label: string;
};

type DatePresetId =
  | "today"
  | "yesterday"
  | "last_week"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month";

type EarningsSource = "all" | "inspection" | "job_card";

const toMoney = (value?: number | null) => Number(value ?? 0).toFixed(2);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const PRESETS: Array<{ id: DatePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_week", label: "Last Week" },
  { id: "last_7_days", label: "Last 7 Days" },
  { id: "last_30_days", label: "Last 30 Days" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
];

export default function CompanyWorkshopEarningsPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("all");
  const [selectedSource, setSelectedSource] = useState<EarningsSource>("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePresetId | null>(null);
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
    key: "selection";
  }>({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [rows, setRows] = useState<EarningsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/branches?includeInactive=true`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load workshops");
        const json = await res.json();
        const allBranches = Array.isArray(json?.branches) ? json.branches : [];
        const options: WorkshopOption[] = allBranches
          .filter((row: any) => {
            const ownership = String(row?.ownershipType ?? row?.ownership_type ?? "").toLowerCase();
            return ownership === "third_party";
          })
          .map((row: any) => ({
            id: String(row.id),
            label: String(row.displayName ?? row.display_name ?? row.name ?? row.code ?? row.id),
          }));
        if (!active) return;
        setWorkshops(options);
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load workshops");
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  async function applyFilters() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setFiltersApplied(true);
    try {
      const from = new Date(dateRange.startDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.endDate);
      to.setHours(23, 59, 59, 999);

      const qs = new URLSearchParams();
      if (selectedWorkshopId !== "all") qs.set("branchId", selectedWorkshopId);
      if (selectedSource !== "all") qs.set("source", selectedSource);
      qs.set("from", from.toISOString());
      qs.set("to", to.toISOString());

      const res = await fetch(`/api/company/${companyId}/workshop/earnings?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load workshop earnings");
      const json = await res.json();
      setRows(Array.isArray(json?.data) ? json.data : []);
      setShowDatePicker(false);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load workshop earnings");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.inspection_id,
        row.job_card_id,
        row.earning_source,
        row.plate_number,
        row.make,
        row.model,
        row.branch_display_name ?? row.branch_name ?? row.branch_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, rows]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.gross += Number(row.gross_amount ?? 0);
        acc.vat += Number(row.vat_amount ?? 0);
        acc.fines += Number(row.fine_amount ?? 0);
        acc.net += Number(row.total_payable ?? 0);
        if (row.currency) acc.currencies.add(String(row.currency));
        return acc;
      },
      { gross: 0, vat: 0, fines: 0, net: 0, currencies: new Set<string>() }
    );
  }, [filtered]);

  const displayCurrency = totals.currencies.size === 1 ? Array.from(totals.currencies)[0] : "USD";

  function applyPreset(preset: DatePresetId) {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    if (preset === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      start = startOfDay(d);
      end = endOfDay(d);
    } else if (preset === "last_week") {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - diffToMonday);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      start = startOfDay(lastWeekStart);
      end = endOfDay(lastWeekEnd);
    } else if (preset === "last_7_days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = startOfDay(d);
      end = endOfDay(now);
    } else if (preset === "last_30_days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      start = startOfDay(d);
      end = endOfDay(now);
    } else if (preset === "this_month") {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      end = endOfDay(now);
    } else if (preset === "last_month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd = new Date(monthStart);
      lastMonthEnd.setDate(0);
      start = startOfDay(new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1));
      end = endOfDay(lastMonthEnd);
    }

    setSelectedPreset(preset);
    setDateRange({
      key: "selection",
      startDate: start,
      endDate: end,
    });
    setShowDatePicker(false);
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/45 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Workshops / Vendors</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Workshop Earnings</h1>
          <p className="mt-1 text-sm text-slate-300">Verified earnings for third-party workshops (inspections and job cards).</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="mb-4 grid gap-3 lg:grid-cols-[240px_220px_1fr_auto]">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Workshop</label>
              <select
                value={selectedWorkshopId}
                onChange={(e) => setSelectedWorkshopId(e.target.value)}
                className="h-10 w-full rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/30"
              >
                <option value="all">All 3rd Party Workshops</option>
                {workshops.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Earning Source</label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value as EarningsSource)}
                className="h-10 w-full rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/30"
              >
                <option value="all">All Sources</option>
                <option value="inspection">Inspections</option>
                <option value="job_card">Job Cards</option>
              </select>
            </div>

            <div className="relative space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Date Range</label>
              <button
                type="button"
                onClick={() => setShowDatePicker((prev) => !prev)}
                className="h-10 w-full rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 text-left text-sm text-slate-100"
              >
                {dateRange.startDate.toLocaleDateString()} - {dateRange.endDate.toLocaleDateString()}
              </button>
              {showDatePicker && (
                <div className="absolute left-0 top-14 z-30 rounded-lg border border-white/10 bg-slate-950 p-3 shadow-xl">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <div className="grid grid-cols-2 gap-1 md:w-44 md:grid-cols-1">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset.id)}
                          className={`rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                            selectedPreset === preset.id
                              ? "bg-cyan-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <DateRange
                      onChange={(ranges: any) => {
                        const selection = ranges?.selection;
                        if (!selection?.startDate || !selection?.endDate) return;
                        setSelectedPreset(null);
                        setDateRange({
                          key: "selection",
                          startDate: selection.startDate,
                          endDate: selection.endDate,
                        });
                      }}
                      moveRangeOnFirstSelection={false}
                      ranges={[dateRange]}
                      rangeColors={["#06b6d4"]}
                      months={1}
                      direction="horizontal"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={applyFilters}
                disabled={loading}
                className="h-10 rounded-lg bg-cyan-500 px-4 text-xs font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "Applying..." : "Apply Filters"}
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-300">{filtered.length} records</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by plate, inspection/job card, source or workshop"
              className="w-full max-w-xs rounded-lg border border-cyan-400/30 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>

          {!filtersApplied && !loading && !error ? (
            <div className="py-8 text-sm text-slate-400">Select workshop/date range and click Apply Filters.</div>
          ) : null}
          {loading ? <div className="py-8 text-sm text-slate-400">Loading workshop earnings...</div> : null}
          {error ? <div className="py-3 text-sm text-rose-400">{error}</div> : null}

          {filtersApplied && !loading && !error && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-300">
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Car</th>
                      <th className="px-3 py-2">Workshop</th>
                      <th className="px-3 py-2">Inspection Start</th>
                      <th className="px-3 py-2">Inspection End</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">VAT</th>
                      <th className="px-3 py-2">Fines</th>
                      <th className="px-3 py-2">Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const currency = row.currency ?? "USD";
                      const workshop = row.branch_display_name ?? row.branch_name ?? row.branch_code ?? "-";
                      const carDetails = [row.plate_number, row.make, row.model, row.model_year].filter(Boolean).join(" ");
                      const sourceLabel = row.earning_source === "job_card" ? "Job Card" : "Inspection";
                      const referenceId = row.earning_source === "job_card" ? row.job_card_id : row.inspection_id;
                      return (
                        <tr key={row.id} className="border-t border-white/10">
                          <td className="px-3 py-2">
                            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                              {sourceLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {referenceId ? `${referenceId.slice(0, 8)}...` : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-100">{carDetails || "-"}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-200">{workshop}</td>
                          <td className="px-3 py-2 text-slate-300">{formatDate(row.start_at)}</td>
                          <td className="px-3 py-2 text-slate-300">{formatDate(row.complete_at)}</td>
                          <td className="px-3 py-2 text-slate-200">
                            {currency} {toMoney(row.gross_amount)}
                          </td>
                          <td className="px-3 py-2 text-slate-200">
                            {currency} {toMoney(row.vat_amount)} ({Number(row.vat_rate ?? 0).toFixed(2)}%)
                          </td>
                          <td className="px-3 py-2 text-rose-300">
                            {currency} {toMoney(row.fine_amount)}
                          </td>
                          <td className="px-3 py-2 font-semibold text-emerald-300">
                            {currency} {toMoney(row.total_payable)}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                          No earnings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filtered.length > 0 && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Total Summary</div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md bg-white/5 px-3 py-2">
                      <div className="text-xs text-slate-400">Gross Amount</div>
                      <div className="font-semibold text-slate-100">
                        {displayCurrency} {toMoney(totals.gross)}
                      </div>
                    </div>
                    <div className="rounded-md bg-white/5 px-3 py-2">
                      <div className="text-xs text-slate-400">VAT Total</div>
                      <div className="font-semibold text-slate-100">
                        {displayCurrency} {toMoney(totals.vat)}
                      </div>
                    </div>
                    <div className="rounded-md bg-white/5 px-3 py-2">
                      <div className="text-xs text-slate-400">Fines Total</div>
                      <div className="font-semibold text-rose-300">
                        {displayCurrency} {toMoney(totals.fines)}
                      </div>
                    </div>
                    <div className="rounded-md bg-white/5 px-3 py-2">
                      <div className="text-xs text-slate-400">Net Payable Total</div>
                      <div className="font-semibold text-emerald-300">
                        {displayCurrency} {toMoney(totals.net)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
