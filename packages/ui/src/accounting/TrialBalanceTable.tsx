"use client";

import React, { useMemo } from "react";

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export function TrialBalanceTable({ rows }: { rows: TrialBalanceRow[] }) {
  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const credit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
    return { debit, credit };
  }, [rows]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="py-2 pl-3 pr-4 text-left">Account</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-right">Debit</th>
            <th className="px-3 py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                No balances yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.accountCode} className="border-b last:border-0">
                <td className="py-2 pl-3 pr-4">
                  <div className="font-medium">{row.accountCode}</div>
                  <div className="text-xs text-muted-foreground">{row.accountName}</div>
                </td>
                <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{row.accountType}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.debit.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.credit.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-semibold">
            <td className="py-2 pl-3 pr-4">Totals</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums">{totals.debit.toFixed(2)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{totals.credit.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
