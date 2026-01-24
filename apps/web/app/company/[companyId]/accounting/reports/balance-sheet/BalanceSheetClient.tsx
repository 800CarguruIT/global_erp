"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Card } from "@repo/ui";

type Row = {
  headingName: string;
  subheadingName: string;
  groupName: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
};
type BalanceSheetResponse = { data?: Row[]; companyName?: string | null };

export default function BalanceSheetClient({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => dayjs(), []);
  const [rangePreset, setRangePreset] = useState("today");
  const [from, setFrom] = useState(() => today.format("YYYY-MM-DD"));
  const [to, setTo] = useState(() => today.format("YYYY-MM-DD"));
  const [companyName, setCompanyName] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/company/${companyId}/accounting/balance-sheet?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load balance sheet");
      const json = (await res.json()) as BalanceSheetResponse;
      setRows(json.data ?? []);
      setCompanyName(json.companyName ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

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

  const grouped = React.useMemo(() => {
    const headings = new Map<
      string,
      Map<string, Map<string, { accounts: Row[]; totals: { debit: number; credit: number; balance: number } }>>
    >();
    for (const row of rows) {
      if (!headings.has(row.headingName)) headings.set(row.headingName, new Map());
      const subMap = headings.get(row.headingName)!;
      if (!subMap.has(row.subheadingName)) subMap.set(row.subheadingName, new Map());
      const groupMap = subMap.get(row.subheadingName)!;
      if (!groupMap.has(row.groupName)) {
        groupMap.set(row.groupName, { accounts: [], totals: { debit: 0, credit: 0, balance: 0 } });
      }
      const group = groupMap.get(row.groupName)!;
      group.accounts.push(row);
      group.totals.debit += Number(row.debit ?? 0);
      group.totals.credit += Number(row.credit ?? 0);
      group.totals.balance += Number(row.balance ?? 0);
    }
    return headings;
  }, [rows]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (heading: string, sub: string, group: string) => {
    const key = `${heading}::${sub}::${group}`;
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const countGroupRows = React.useCallback(
    (heading: string, sub: string, group: string, groupData: { accounts: Row[] }) => {
      const key = `${heading}::${sub}::${group}`;
      const open = openGroups.has(key);
      if (!open) return 1;
      return Math.max(groupData.accounts.length, 1) + 1; // accounts + total row
    },
    [openGroups]
  );

  const countSubheadingRows = React.useCallback(
    (heading: string, sub: string, groupMap: Map<string, { accounts: Row[] }>) => {
      let total = 0;
      groupMap.forEach((groupData, group) => {
        total += countGroupRows(heading, sub, group, groupData);
      });
      return Math.max(total, 1) + 1; // subheading total row
    },
    [countGroupRows]
  );

  const countHeadingRows = React.useCallback(
    (heading: string, subMap: Map<string, Map<string, { accounts: Row[] }>>) => {
      let total = 0;
      subMap.forEach((groupMap, sub) => {
        total += countSubheadingRows(heading, sub, groupMap);
      });
      return Math.max(total, 1) + 1; // heading total row
    },
    [countSubheadingRows]
  );

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">
            {companyName ? `${companyName} â€” ` : ""}
            Review assets, liabilities, and equity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
            className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90"
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
                className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90"
              />
              <input
                type="date"
                value={to ?? ""}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90"
              />
            </>
          ) : (
            <div className="rounded-full border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80">
              {from} → {to}
            </div>
          )}
          <button
            onClick={load}
            className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <Card>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                    <th className="px-3 py-2">Heading Name</th>
                    <th className="px-3 py-2">Sub Heading Name</th>
                    <th className="px-3 py-2">Group Name</th>
                    <th className="px-3 py-2">Account Code</th>
                    <th className="px-3 py-2">Account Name</th>
                    <th className="px-3 py-2">Debit</th>
                    <th className="px-3 py-2">Credit</th>
                    <th className="px-3 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(grouped.entries()).map(([heading, subMap]) => {
                    let headingTotals = { debit: 0, credit: 0, balance: 0 };
                    const headingRowSpan = countHeadingRows(heading, subMap as any);
                    let headingRendered = false;
                    return (
                      <React.Fragment key={heading}>
                        {Array.from(subMap.entries()).map(([subheading, groupMap]) => {
                          let subTotals = { debit: 0, credit: 0, balance: 0 };
                          const subRowSpan = countSubheadingRows(heading, subheading, groupMap as any);
                          let subRendered = false;
                          return (
                            <React.Fragment key={`${heading}::${subheading}`}>
                              {Array.from(groupMap.entries()).map(([group, groupData]) => {
                                const groupKey = `${heading}::${subheading}::${group}`;
                                const groupOpen = openGroups.has(groupKey);
                                const groupRowSpan = countGroupRows(heading, subheading, group, groupData);
                                subTotals.debit += groupData.totals.debit;
                                subTotals.credit += groupData.totals.credit;
                                subTotals.balance += groupData.totals.balance;
                                headingTotals.debit += groupData.totals.debit;
                                headingTotals.credit += groupData.totals.credit;
                                headingTotals.balance += groupData.totals.balance;
                                const firstAccount = groupData.accounts[0];
                                const hasAccounts = groupData.accounts.length > 0;
                                const renderAccountRow = (
                                  account: Row,
                                  isFirstRow: boolean,
                                  renderHeading: boolean,
                                  renderSub: boolean
                                ) => (
                                  <tr key={`${groupKey}::${account.accountCode}`} className="border-b border-white/5">
                                    {isFirstRow && renderHeading && (
                                      <td className="px-3 py-2 font-semibold" rowSpan={headingRowSpan}>
                                        {heading}
                                      </td>
                                    )}
                                    {isFirstRow && renderSub && (
                                      <td className="px-3 py-2 font-semibold" rowSpan={subRowSpan}>
                                        {subheading}
                                      </td>
                                    )}
                                    {isFirstRow && (
                                      <td className="px-3 py-2 font-semibold" rowSpan={groupRowSpan}>
                                        <button
                                          type="button"
                                          onClick={() => toggleGroup(heading, subheading, group)}
                                          className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-white/15 text-xs text-white/80"
                                        >
                                          {groupOpen ? "−" : "+"}
                                        </button>
                                        {group}
                                      </td>
                                    )}
                                    {!isFirstRow && null}
                                    <td className="px-3 py-2">
                                      <Link
                                        href={`/company/${companyId}/accounting/reports/account-statement?accountCode=${encodeURIComponent(
                                          account.accountCode
                                        )}`}
                                        className="text-primary hover:underline"
                                      >
                                        {account.accountCode}
                                      </Link>
                                    </td>
                                    <td className="px-3 py-2">{account.accountName}</td>
                                    <td className="px-3 py-2">{account.debit.toLocaleString()} AED</td>
                                    <td className="px-3 py-2">{account.credit.toLocaleString()} AED</td>
                                    <td className="px-3 py-2">{account.balance.toLocaleString()} AED</td>
                                  </tr>
                                );

                                return (
                                  <React.Fragment key={groupKey}>
                                    {(() => {
                                      const placeholder: Row = {
                                        headingName: heading,
                                        subheadingName: subheading,
                                        groupName: group,
                                        accountCode: "",
                                        accountName: "",
                                        debit: 0,
                                        credit: 0,
                                        balance: 0,
                                      };
                                      const renderHeading = !headingRendered;
                                      const renderSub = !subRendered;
                                      if (groupOpen && hasAccounts) {
                                        return groupData.accounts.map((account, idx) =>
                                          renderAccountRow(account, idx === 0, renderHeading && idx === 0, renderSub && idx === 0)
                                        );
                                      }
                                      return renderAccountRow(placeholder, true, renderHeading, renderSub);
                                    })()}
                                    {(() => {
                                      if (!headingRendered) headingRendered = true;
                                      if (!subRendered) subRendered = true;
                                      return null;
                                    })()}
                                    {groupOpen && (
                                      <tr className="border-b border-white/5 bg-white/5">
                                        <td className="px-3 py-2 font-semibold text-white/90" colSpan={2}>
                                          {`Total for ${group}:`}
                                        </td>
                                        <td className="px-3 py-2">{groupData.totals.debit.toLocaleString()} AED</td>
                                        <td className="px-3 py-2">{groupData.totals.credit.toLocaleString()} AED</td>
                                        <td className="px-3 py-2">{groupData.totals.balance.toLocaleString()} AED</td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                              <tr className="border-b border-white/10 bg-emerald-500/80 text-white">
                                <td className="px-3 py-2 font-semibold" colSpan={3}>{`Total for ${subheading}:`}</td>
                                <td className="px-3 py-2">{subTotals.debit.toLocaleString()} AED</td>
                                <td className="px-3 py-2">{subTotals.credit.toLocaleString()} AED</td>
                                <td className="px-3 py-2">{subTotals.balance.toLocaleString()} AED</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        <tr className="border-b border-white/10 bg-emerald-600 text-white">
                          <td className="px-3 py-2 font-semibold" colSpan={4}>{`Total for ${heading}:`}</td>
                          <td className="px-3 py-2">{headingTotals.debit.toLocaleString()} AED</td>
                          <td className="px-3 py-2">{headingTotals.credit.toLocaleString()} AED</td>
                          <td className="px-3 py-2">{headingTotals.balance.toLocaleString()} AED</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {rows.length > 0 && (() => {
                    const totals = rows.reduce(
                      (acc, r) => {
                        acc.debit += Number(r.debit ?? 0);
                        acc.credit += Number(r.credit ?? 0);
                        acc.balance += Number(r.balance ?? 0);
                        return acc;
                      },
                      { debit: 0, credit: 0, balance: 0 }
                    );
                    return (
                      <tr className="bg-amber-500 text-slate-900 font-semibold">
                        <td className="px-3 py-2 text-right" colSpan={5}>Grand Total</td>
                        <td className="px-3 py-2">{totals.debit.toLocaleString()} AED</td>
                        <td className="px-3 py-2">{totals.credit.toLocaleString()} AED</td>
                        <td className="px-3 py-2">{totals.balance.toLocaleString()} AED</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
