"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Select from "react-select";
import { Card, useTheme } from "@repo/ui";

type AccountOption = { accountCode: string; accountName: string };
type StatementRow = {
  id: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  date: string;
};

type StatementResponse = {
  data?: StatementRow[];
  account?: { code: string; name: string } | null;
  companyName?: string | null;
  openingBalance?: number;
};

export default function AccountStatementClient({
  companyId,
  initialAccountCode,
}: {
  companyId: string;
  initialAccountCode?: string;
}) {
  const today = useMemo(() => dayjs(), []);
  const [rangePreset, setRangePreset] = useState("thisMonth");
  const [from, setFrom] = useState(() => today.startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(() => today.endOf("month").format("YYYY-MM-DD"));
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountCode, setAccountCode] = useState(initialAccountCode ?? "");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const { theme } = useTheme();

  useEffect(() => {
    const now = dayjs();
    switch (rangePreset) {
      case "today":
        setFrom(now.format("YYYY-MM-DD"));
        setTo(now.format("YYYY-MM-DD"));
        break;
      case "yesterday":
        setFrom(now.subtract(1, "day").format("YYYY-MM-DD"));
        setTo(now.subtract(1, "day").format("YYYY-MM-DD"));
        break;
      case "last7":
        setFrom(now.subtract(6, "day").format("YYYY-MM-DD"));
        setTo(now.format("YYYY-MM-DD"));
        break;
      case "last30":
        setFrom(now.subtract(29, "day").format("YYYY-MM-DD"));
        setTo(now.format("YYYY-MM-DD"));
        break;
      case "thisMonth":
        setFrom(now.startOf("month").format("YYYY-MM-DD"));
        setTo(now.endOf("month").format("YYYY-MM-DD"));
        break;
      case "lastMonth": {
        const last = now.subtract(1, "month");
        setFrom(last.startOf("month").format("YYYY-MM-DD"));
        setTo(last.endOf("month").format("YYYY-MM-DD"));
        break;
      }
      case "custom":
      default:
        break;
    }
  }, [rangePreset]);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      try {
        const res = await fetch(`/api/accounting/accounts?companyId=${companyId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load accounts");
        const json = await res.json();
        if (!active) return;
        const list = (json.data ?? []).map((a: any) => ({
          accountCode: a.accountCode,
          accountName: a.accountName,
        }));
        setAccounts(list);
        if (!accountCode && list.length > 0) {
          setAccountCode(list[0].accountCode);
        }
      } catch (err) {
        if (active) setAccounts([]);
      }
    }
    loadAccounts();
    return () => {
      active = false;
    };
  }, [companyId]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.description.toLowerCase().includes(term) ||
        r.type.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.accountCode,
        label: `${a.accountCode} - ${a.accountName}`,
      })),
    [accounts]
  );

  const pagedRows = useMemo(() => filteredRows.slice(0, pageSize), [filteredRows, pageSize]);

  async function load() {
    if (!accountCode) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        accountCode,
        from,
        to,
      });
      const res = await fetch(`/api/company/${companyId}/accounting/account-statement?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load account statement");
      const json = (await res.json()) as StatementResponse;
      setRows(json.data ?? []);
      setCompanyName(json.companyName ?? null);
      setAccountName(json.account?.name ?? null);
      setOpeningBalance(Number(json.openingBalance ?? 0));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load account statement");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accountCode) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCode, from, to]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Account Statement{accountName ? ` - ${accountName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {companyName ? `${companyName} — ` : ""}
            Detailed ledger entries for the selected account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="min-w-[260px]">
            <Select
              options={accountOptions}
              value={accountOptions.find((o) => o.value === accountCode) ?? null}
              onChange={(option) => setAccountCode(option?.value ?? "")}
              isClearable
              placeholder="Select account..."
              classNamePrefix="react-select"
              styles={{
                control: (base) => ({
                  ...base,
                  backgroundColor: theme.id === "light" ? "#fff" : "rgba(0,0,0,0.3)",
                  borderColor: "rgba(255,255,255,0.15)",
                  minHeight: "38px",
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: theme.id === "light" ? "#fff" : "rgba(10,10,20,0.95)",
                  color: theme.id === "light" ? "#0f172a" : "#f8fafc",
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isFocused
                    ? theme.id === "light"
                      ? "#e2e8f0"
                      : "rgba(148,163,184,0.2)"
                    : "transparent",
                  color: theme.id === "light" ? "#0f172a" : "#f8fafc",
                }),
                singleValue: (base) => ({
                  ...base,
                  color: theme.id === "light" ? "#0f172a" : "#f8fafc",
                }),
                placeholder: (base) => ({
                  ...base,
                  color: theme.id === "light" ? "#64748b" : "#94a3b8",
                }),
                input: (base) => ({
                  ...base,
                  color: theme.id === "light" ? "#0f172a" : "#f8fafc",
                }),
              }}
            />
          </div>
          <select
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
            className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom</option>
          </select>
          {rangePreset === "custom" ? (
            <>
              <input
                type="date"
                value={from ?? ""}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90"
              />
              <input
                type="date"
                value={to ?? ""}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90"
              />
            </>
          ) : (
            <div className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80">
              {from} → {to}
            </div>
          )}
          <button
            onClick={load}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:opacity-90"
          >
            Get
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-white/70">Show</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs text-white/90"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-white/60">rows</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-white/70">Search:</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs text-white/90"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Debit</th>
                  <th className="px-3 py-2">Credit</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Date Created</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-emerald-600 text-white font-semibold">
                  <td className="px-3 py-2">Opening</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">Opening Balance</td>
                  <td className="px-3 py-2">{openingBalance.toLocaleString()}</td>
                  <td className="px-3 py-2">0</td>
                  <td className="px-3 py-2">{openingBalance.toLocaleString()}</td>
                  <td className="px-3 py-2">Previous</td>
                </tr>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-3 py-2">{r.id}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2">{r.debit.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.credit.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.balance.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.date}</td>
                  </tr>
                ))}
                {pagedRows.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={7}>
                      No entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
