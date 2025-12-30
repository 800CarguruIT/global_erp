"use client";

import React from "react";

export interface JournalEntryListTableProps {
  entries: Array<{
    id: string;
    date: string;
    reference?: string | null;
    description?: string | null;
    totalDebit: number;
    totalCredit: number;
  }>;
  onCreate?: () => void;
  onRowClick?: (id: string) => void;
}

export function JournalEntryListTable({ entries, onCreate, onRowClick }: JournalEntryListTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Journal Entries</h2>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-white/10"
          >
            New Journal Entry
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="py-2 pl-3 pr-4 text-left">Date</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Total Debit</th>
              <th className="px-3 py-2 text-right">Total Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                  No journal entries yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                  onClick={() => onRowClick?.(entry.id)}
                >
                  <td className="py-2 pl-3 pr-4 text-xs text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{entry.reference ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{entry.description ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{entry.totalDebit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{entry.totalCredit.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
